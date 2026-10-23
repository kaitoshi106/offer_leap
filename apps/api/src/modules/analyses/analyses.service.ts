import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AnalysisDetail,
  type AnalysisSummary,
  type CreateAnalysis,
  ErrorCode,
  ValidationRule,
  type PageQuery,
  type Paginated,
} from '@offerleap/shared';
import type { Queue } from 'bullmq';

import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { enqueueAiJob } from '../ai/ai-job';
import { AI_PROVIDER, type AiProvider } from '../ai/ai.types';
import {
  buildJobMatchParts,
  JOB_MATCH_TASK,
  jobMatchSchema,
  jobMatchSystem,
} from '../ai/prompts/job-match.v2';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ResumesService } from '../resumes/resumes.service';
import { ANALYSIS_INCLUDE, toAnalysisDetail, toAnalysisResult, toAnalysisSummary } from './analysis.mapper';
import { ANALYSIS_QUEUE, type AnalysisJob } from './analyses.types';

/** Compares a user's CV with a job description using the AI, in the background. */
@Injectable()
export class AnalysesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resumes: ResumesService,
    private readonly knowledge: KnowledgeService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue<AnalysisJob>,
  ) {}

  /**
   * @description Stores the request and queues the AI work. Returns at once with status PENDING; the client
   * polls `findOwned`.
   * @param userId - Owner.
   * @param input - CV to use, job description and answer language.
   * @throws AppException COMMON_VALIDATION_FAILED when the CV isn't one of the user's.
   */
  async create(userId: string, input: CreateAnalysis): Promise<AnalysisDetail> {
    const resume = await this.prisma.resume.findFirst({
      where: { id: input.resumeId, userId },
      select: { id: true },
    });
    if (!resume) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'Unknown resume',
        fieldErrors: [{ field: 'resumeId', rule: ValidationRule.INVALID }],
      });
    }

    const analysis = await this.prisma.jobAnalysis.create({
      data: { userId, resumeId: resume.id, jobDescription: input.jobDescription, locale: input.locale },
      include: ANALYSIS_INCLUDE,
    });
    await enqueueAiJob(this.queue, 'analyse', { analysisId: analysis.id }, analysis.id, () =>
      this.markFailed(analysis.id, ErrorCode.ANALYSIS_FAILED),
    );
    return toAnalysisDetail(analysis);
  }

  /** One page of the user's analyses, newest first. */
  async list(userId: string, query: PageQuery): Promise<Paginated<AnalysisSummary>> {
    const where = { userId };
    const [total, analyses] = await this.prisma.$transaction([
      this.prisma.jobAnalysis.count({ where }),
      this.prisma.jobAnalysis.findMany({
        where,
        include: ANALYSIS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: analyses.map(toAnalysisSummary), total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * @description One of the user's analyses; someone else's id gives the same 404 as a missing one.
   * @throws AppException COMMON_NOT_FOUND.
   */
  async findOwned(userId: string, id: string): Promise<AnalysisDetail> {
    const analysis = await this.prisma.jobAnalysis.findFirst({
      where: { id, userId },
      include: ANALYSIS_INCLUDE,
    });
    if (!analysis) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Analysis not found' });
    return toAnalysisDetail(analysis);
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.jobAnalysis.deleteMany({ where: { id, userId } });
    if (count === 0) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Analysis not found' });
  }

  /**
   * @description Worker step: sends the CV and the job description to the AI and stores the result.
   * @param analysisId - Row to process. Missing (deleted) or finished rows are skipped.
   * @throws AiUnavailableError (retry later) or AiInvalidOutputError (give up).
   */
  async analyse(analysisId: string): Promise<void> {
    const analysis = await this.prisma.jobAnalysis.findUnique({
      where: { id: analysisId },
      include: { resume: { select: { storageKey: true, mimeType: true } } },
    });
    if (!analysis || analysis.status === 'COMPLETED') return;
    await this.prisma.jobAnalysis.update({ where: { id: analysisId }, data: { status: 'PROCESSING' } });

    const document = await this.resumes.loadDocument(analysis.resume);
    // RAG: passages from the user's own documents closest to this job (none if they have no documents).
    const notes = await this.knowledge.search(analysis.userId, analysis.jobDescription, {
      limit: 4,
      relevantOnly: true,
    });
    const answer = await this.ai.generateJson({
      userId: analysis.userId,
      task: JOB_MATCH_TASK,
      system: jobMatchSystem(analysis.locale, new Date()),
      parts: buildJobMatchParts(document, analysis.jobDescription, notes),
      schema: jobMatchSchema,
    });
    const { jobTitle, company, result } = toAnalysisResult(answer.data, notes);

    // updateMany: the user may have deleted the analysis while the AI was working.
    await this.prisma.jobAnalysis.updateMany({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        jobTitle,
        company,
        score: result.score,
        // Interfaces have no index signature, so TypeScript can't see they are plain JSON.
        result: result as unknown as Prisma.InputJsonObject,
        errorCode: null,
        aiModel: answer.model,
        inputTokens: answer.usage.inputTokens,
        outputTokens: answer.usage.outputTokens,
        processedAt: new Date(),
      },
    });
  }

  async markFailed(analysisId: string, errorCode: ErrorCode): Promise<void> {
    await this.prisma.jobAnalysis.updateMany({
      where: { id: analysisId },
      data: { status: 'FAILED', errorCode, processedAt: new Date() },
    });
  }
}
