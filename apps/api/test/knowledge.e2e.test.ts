import { ErrorCode, KNOWLEDGE_LIMITS, type KnowledgeDocument } from '@offerleap/shared';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiProvider } from '../src/modules/ai/ai.types';
import { MockAiProvider } from '../src/modules/ai/providers/mock.provider';
import { StorageService } from '../src/storage/storage.service';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

const ai = {
  name: 'test',
  similarityFloor: 0.2,
  generateJson: vi.fn(),
  streamText: vi.fn(),
  embed: vi.fn(),
} satisfies AiProvider;
const mock = new MockAiProvider();

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp({ ai });
  await seedTaxonomies(ctx.prisma);
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ai.generateJson.mockReset().mockImplementation((request) => mock.generateJson(request));
  ai.embed.mockReset().mockImplementation((request) => mock.embed(request));
});

const GRAPHQL_NOTE = `Dự án Shopify Admin clone (2024): xây dựng API GraphQL với Apollo Server, schema stitching,
DataLoader để tránh N+1, và kiểm thử end-to-end bằng Playwright cho toàn bộ luồng thanh toán.`;
const COOKING_NOTE = 'Sở thích: nấu phở bò, làm bánh mì, chụp ảnh phong cảnh vào cuối tuần cùng gia đình.';

async function waitReady(agent: TestAgent, id: string): Promise<KnowledgeDocument> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await agent.get('/api/v1/knowledge').expect(200);
    const document = body.find((item: KnowledgeDocument) => item.id === id);
    if (['COMPLETED', 'FAILED'].includes(document.status)) return document;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Document was not processed in time');
}

async function addNote(agent: TestAgent, title: string, content: string) {
  const { body } = await agent.post('/api/v1/knowledge/text').send({ title, content }).expect(202);
  return waitReady(agent, body.id);
}

describe('knowledge (RAG)', () => {
  it('processes pasted text and uploaded files into searchable passages', async () => {
    const agent = await signUpOnboarded(ctx);

    const note = await addNote(agent, 'Dự án GraphQL', GRAPHQL_NOTE);
    expect(note).toMatchObject({ status: 'COMPLETED', source: 'TEXT', chunkCount: 1 });
    const { body: uploaded } = await agent
      .post('/api/v1/knowledge/upload')
      .attach('file', Buffer.from(COOKING_NOTE), 'so-thich.txt')
      .expect(202);
    expect(uploaded).toMatchObject({ title: 'so-thich', fileName: 'so-thich.txt', source: 'UPLOAD' });
    expect((await waitReady(agent, uploaded.id)).status).toBe('COMPLETED');

    // Documents are embedded as documents, queries as queries.
    expect(ai.embed.mock.calls[0]![0]).toMatchObject({ task: 'embed-document', purpose: 'document' });

    const search = await agent
      .get('/api/v1/knowledge/search')
      .query({ q: 'kinh nghiệm GraphQL Apollo' })
      .expect(200);
    expect(search.body[0]).toMatchObject({ documentId: note.id, title: 'Dự án GraphQL', relevant: true });
    expect(search.body[1]).toMatchObject({ title: 'so-thich', relevant: false });
    expect(search.body[0].score).toBeGreaterThan(search.body[1].score);
    expect(ai.embed.mock.calls.at(-1)![0]).toMatchObject({ task: 'embed-query', purpose: 'query' });

    // Embeddings are logged but don't use up the AI quota.
    expect(await ctx.prisma.aiUsageLog.count({ where: { task: { startsWith: 'embed' } } })).toBe(3);
    expect((await agent.get('/api/v1/ai/quota').expect(200)).body.used).toBe(0);
  });

  it('gives the analysis the relevant passages and lists them as sources', async () => {
    const agent = await signUpOnboarded(ctx);
    const note = await addNote(agent, 'Dự án GraphQL', GRAPHQL_NOTE);
    await addNote(agent, 'Sở thích', COOKING_NOTE);
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    const resume = await ctx.prisma.resume.create({
      data: {
        userId: user.id,
        fileName: 'cv.txt',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        storageKey: `x/${user.id}.pdf`,
      },
    });
    await ctx.app.get(StorageService).put(resume.storageKey, Buffer.from('%PDF-1.7'));

    const { body } = await agent
      .post('/api/v1/analyses')
      .send({
        resumeId: resume.id,
        // The mock embedding only counts shared words, so the job shares several with the GraphQL note.
        jobDescription:
          'Senior Engineer: API GraphQL với Apollo Server, DataLoader, kiểm thử end-to-end bằng Playwright cho luồng thanh toán.',
        locale: 'en',
      })
      .expect(202);
    let analysis = body;
    for (let attempt = 0; attempt < 100 && analysis.status !== 'COMPLETED'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      analysis = (await agent.get(`/api/v1/analyses/${body.id}`).expect(200)).body;
    }

    const request = ai.generateJson.mock.calls.find(([call]) => call.task === 'job-match.v2')![0];
    const notes = request.parts.find((part: { text?: string }) => part.text?.startsWith('<notes>'));
    expect(notes.text).toContain('Dự án GraphQL');
    // The unrelated note is below the similarity floor, so it is left out.
    expect(notes.text).not.toContain('Sở thích');
    expect(analysis.result.sources).toEqual([
      expect.objectContaining({
        documentId: note.id,
        title: 'Dự án GraphQL',
        excerpt: expect.stringContaining('GraphQL'),
      }),
    ]);
  });

  it('skips retrieval entirely for users without documents', async () => {
    const agent = await signUpOnboarded(ctx);
    expect((await agent.get('/api/v1/knowledge/search').query({ q: 'GraphQL' }).expect(200)).body).toEqual(
      [],
    );
    expect(ai.embed).not.toHaveBeenCalled();
  });

  it('keeps to the document limit when several are added at the same time', async () => {
    const agent = await signUpOnboarded(ctx);
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    // One place left.
    await ctx.prisma.knowledgeDocument.createMany({
      data: Array.from({ length: KNOWLEDGE_LIMITS.documentsPerUser - 1 }, (_, index) => ({
        userId: user.id,
        title: `Doc ${index}`,
        source: 'TEXT' as const,
        status: 'COMPLETED' as const,
      })),
    });

    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        agent.post('/api/v1/knowledge/text').send({ title: `Note ${index}`, content: GRAPHQL_NOTE }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([202, 409, 409, 409]);
    expect(await ctx.prisma.knowledgeDocument.count({ where: { userId: user.id } })).toBe(
      KNOWLEDGE_LIMITS.documentsPerUser,
    );
  });

  it('rejects unsupported files, too many documents and other users', async () => {
    const agent = await signUpOnboarded(ctx);
    const binary = await agent
      .post('/api/v1/knowledge/upload')
      .attach('file', Buffer.from([0, 1, 2, 255]), 'x.bin');
    expect(binary.body.code).toBe(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE);

    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    await ctx.prisma.knowledgeDocument.createMany({
      data: Array.from({ length: KNOWLEDGE_LIMITS.documentsPerUser }, (_, index) => ({
        userId: user.id,
        title: `Doc ${index}`,
        source: 'TEXT' as const,
        status: 'COMPLETED' as const,
      })),
    });
    const full = await agent
      .post('/api/v1/knowledge/text')
      .send({ title: 'One more', content: GRAPHQL_NOTE })
      .expect(409);
    expect(full.body.code).toBe(ErrorCode.KNOWLEDGE_LIMIT_REACHED);

    const doc = await ctx.prisma.knowledgeDocument.findFirstOrThrow({ where: { userId: user.id } });
    const other = await signUpOnboarded(ctx, 'other@example.com');
    await other.delete(`/api/v1/knowledge/${doc.id}`).expect(404);
    expect((await other.get('/api/v1/knowledge').expect(200)).body).toEqual([]);
  });

  it('deletes a document with its passages', async () => {
    const agent = await signUpOnboarded(ctx);
    const note = await addNote(agent, 'Dự án GraphQL', GRAPHQL_NOTE);
    await agent.delete(`/api/v1/knowledge/${note.id}`).expect(204);
    expect(await ctx.prisma.knowledgeChunk.count()).toBe(0);
  });
});
