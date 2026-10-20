import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateTextDocumentInput,
  ErrorCode,
  KNOWLEDGE_FILE_TYPES,
  KNOWLEDGE_LIMITS,
  type KnowledgeDocument,
  type KnowledgeMatch,
  type KnowledgeMimeType,
} from '@offerleap/shared';
import type { Queue } from 'bullmq';

import { AppException } from '../../common/errors/app.exception';
import type { KnowledgeDocument as DocumentRow } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AI_JOB_OPTIONS } from '../ai/ai-job';
import { AiInvalidOutputError } from '../ai/ai.errors';
import { AI_PROVIDER, type AiProvider } from '../ai/ai.types';
import { toVectorLiteral } from '../ai/providers/vectors';
import { chunkText, normalizeText } from './chunker';
import { KNOWLEDGE_QUEUE, type KnowledgeJob } from './knowledge.types';
import { detectKnowledgeType, extractDocumentText } from './text-extraction';

function toDocument(row: DocumentRow): KnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    fileName: row.fileName,
    status: row.status,
    errorCode: (row.errorCode as ErrorCode | null) ?? null,
    chunkCount: row.chunkCount,
    charCount: row.charCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Personal documents for retrieval-augmented generation (RAG): stored, split into chunks, embedded in the
 * background, then searched by meaning (cosine similarity in pgvector) when an AI feature needs background.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @InjectQueue(KNOWLEDGE_QUEUE) private readonly queue: Queue<KnowledgeJob>,
  ) {}

  async list(userId: string): Promise<KnowledgeDocument[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toDocument);
  }

  /**
   * @description Stores an uploaded file and queues its processing.
   * @throws AppException COMMON_UNSUPPORTED_FILE_TYPE / KNOWLEDGE_LIMIT_REACHED.
   */
  async upload(userId: string, file: { originalname: string; buffer: Buffer }): Promise<KnowledgeDocument> {
    const type = detectKnowledgeType(file.buffer, file.originalname);
    if (!type)
      throw new AppException(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE, { message: 'Not a supported document' });
    await this.assertBelowLimit(userId);

    const storageKey = `knowledge/${userId}/${randomUUID()}${KNOWLEDGE_FILE_TYPES[type]}`;
    await this.storage.put(storageKey, file.buffer);
    const title = file.originalname.replace(/\.[^.]+$/, '').slice(0, KNOWLEDGE_LIMITS.titleMax) || 'Document';
    return this.createAndQueue({
      userId,
      title,
      source: 'UPLOAD',
      fileName: file.originalname.slice(0, 255),
      mimeType: type,
      storageKey,
    });
  }

  /** Stores pasted text (as a file, so processing is the same) and queues it. @throws KNOWLEDGE_LIMIT_REACHED. */
  async createText(userId: string, input: CreateTextDocumentInput): Promise<KnowledgeDocument> {
    await this.assertBelowLimit(userId);
    const storageKey = `knowledge/${userId}/${randomUUID()}.txt`;
    await this.storage.put(storageKey, Buffer.from(input.content, 'utf8'));
    return this.createAndQueue({
      userId,
      title: input.title,
      source: 'TEXT',
      mimeType: 'text/plain',
      storageKey,
    });
  }

  /** Deletes a document, its chunks (cascade) and its file. @throws COMMON_NOT_FOUND. */
  async remove(userId: string, id: string): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findFirst({ where: { id, userId } });
    if (!document) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Document not found' });
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    if (document.storageKey) await this.storage.remove(document.storageKey);
  }

  /**
   * @description Worker step: extract text, split into chunks, embed them and store the vectors.
   * @throws AiUnavailableError (retry later) or AiInvalidOutputError (no readable text — give up).
   */
  async process(documentId: string): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!document || document.status === 'COMPLETED' || !document.storageKey) return;
    await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'PROCESSING' } });

    const data = await this.storage.get(document.storageKey);
    const text = normalizeText(await extractDocumentText(data, document.mimeType as KnowledgeMimeType)).slice(
      0,
      KNOWLEDGE_LIMITS.chars,
    );
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new AiInvalidOutputError('The document has no readable text');

    const { vectors, model } = await this.ai.embed({
      userId: document.userId,
      task: 'embed-document',
      texts: chunks,
      purpose: 'document',
    });

    // Replace any chunks of an earlier attempt, then write the new ones with their vectors in one transaction.
    await this.prisma.$transaction([
      this.prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
      ...chunks.map(
        (content, index) => this.prisma.$executeRaw`
          INSERT INTO knowledge_chunks (id, "documentId", "userId", index, content, embedding)
          VALUES (${randomUUID()}, ${documentId}, ${document.userId}, ${index}, ${content},
                  ${toVectorLiteral(vectors[index]!)}::vector)`,
      ),
      this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          errorCode: null,
          chunkCount: chunks.length,
          charCount: text.length,
          embeddingModel: model,
          processedAt: new Date(),
        },
      }),
    ]);
  }

  async markFailed(documentId: string, errorCode: ErrorCode): Promise<void> {
    await this.prisma.knowledgeDocument.updateMany({
      where: { id: documentId },
      data: { status: 'FAILED', errorCode, processedAt: new Date() },
    });
  }

  /**
   * @description Finds the user's passages closest in meaning to a query: the query is embedded, then pgvector
   * orders the user's chunks by cosine distance (`<=>`). Exact search — a user has a few hundred chunks at most.
   * Returns nothing (and costs nothing) when the user has no processed documents.
   * @param userId - Owner; only their chunks are searched.
   * @param query - Natural-language query (e.g. a job description).
   * @param options.limit - Maximum passages.
   * @param options.relevantOnly - Drop passages below the provider's similarity floor (for prompts).
   */
  async search(
    userId: string,
    query: string,
    { limit = 5, relevantOnly = false }: { limit?: number; relevantOnly?: boolean } = {},
  ): Promise<KnowledgeMatch[]> {
    const hasChunks = await this.prisma.knowledgeChunk.count({ where: { userId }, take: 1 });
    if (!hasChunks) return [];

    const {
      vectors: [vector],
    } = await this.ai.embed({
      userId,
      task: 'embed-query',
      texts: [query.slice(0, 2_000)],
      purpose: 'query',
    });
    const literal = toVectorLiteral(vector!);
    // Parameters are bound by Prisma (no string concatenation): the vector literal is cast server-side.
    const rows = await this.prisma.$queryRaw<
      { documentId: string; title: string; content: string; score: number }[]
    >`
      SELECT c."documentId", d.title, c.content, 1 - (c.embedding <=> ${literal}::vector) AS score
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c."documentId"
      WHERE c."userId" = ${userId} AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${literal}::vector
      LIMIT ${limit}`;
    const matches = rows.map((row) => {
      const score = Number(row.score);
      return { ...row, score, relevant: score >= this.ai.similarityFloor };
    });
    return relevantOnly ? matches.filter((match) => match.relevant) : matches;
  }

  private async assertBelowLimit(userId: string): Promise<void> {
    const count = await this.prisma.knowledgeDocument.count({ where: { userId } });
    if (count >= KNOWLEDGE_LIMITS.documentsPerUser) throw new AppException(ErrorCode.KNOWLEDGE_LIMIT_REACHED);
  }

  private async createAndQueue(data: {
    userId: string;
    title: string;
    source: 'UPLOAD' | 'TEXT';
    fileName?: string;
    mimeType: string;
    storageKey: string;
  }): Promise<KnowledgeDocument> {
    const document = await this.prisma.knowledgeDocument.create({ data });
    await this.queue.add('process', { documentId: document.id }, { jobId: document.id, ...AI_JOB_OPTIONS });
    return toDocument(document);
  }
}
