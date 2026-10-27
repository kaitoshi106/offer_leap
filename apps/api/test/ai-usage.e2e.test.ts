import { ErrorCode } from '@offerleap/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signInAdmin,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

const START = { jobTitle: 'Frontend Engineer', type: 'MIXED', questionCount: 3, locale: 'en' };
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedTaxonomies(ctx.prisma);
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

describe('AI usage and quotas', () => {
  it('logs every AI call and reports the user quota', async () => {
    const agent = await signUpOnboarded(ctx);
    expect((await agent.get('/api/v1/ai/quota').expect(200)).body).toEqual({
      used: 0,
      limit: 50,
      windowHours: 24,
    });

    await agent.post('/api/v1/interviews').send(START).expect(201);

    const logs = await ctx.prisma.aiUsageLog.findMany();
    expect(logs).toEqual([
      expect.objectContaining({ task: 'interview-questions.v1', model: 'mock', success: true }),
    ]);
    expect((await agent.get('/api/v1/ai/quota').expect(200)).body.used).toBe(1);
  });

  it('stops a user at their limit, for direct calls and background jobs alike', async () => {
    const agent = await signUpOnboarded(ctx);
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    await ctx.prisma.user.update({ where: { id: user.id }, data: { aiDailyQuota: 1 } });

    await agent.post('/api/v1/interviews').send(START).expect(201);
    const refused = await agent.post('/api/v1/interviews').send(START).expect(429);
    expect(refused.body.code).toBe(ErrorCode.AI_QUOTA_EXCEEDED);

    // A queued analysis fails with the same code instead of retrying. (Storing a CV after onboarding needs no AI.)
    const resume = await agent.post('/api/v1/resumes').attach('file', PDF, 'cv.pdf').expect(202);
    const { body } = await agent
      .post('/api/v1/analyses')
      .send({ resumeId: resume.body.id, jobDescription: 'Frontend Developer. '.repeat(10), locale: 'vi' })
      .expect(202);
    let analysis = body;
    for (let attempt = 0; attempt < 100 && !['COMPLETED', 'FAILED'].includes(analysis.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      analysis = (await agent.get(`/api/v1/analyses/${body.id}`).expect(200)).body;
    }
    expect(analysis).toMatchObject({ status: 'FAILED', errorCode: ErrorCode.AI_QUOTA_EXCEEDED });
  });

  it('lets admins see usage and change a user quota', async () => {
    const userAgent = await signUpOnboarded(ctx);
    await userAgent.post('/api/v1/interviews').send(START).expect(201);
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    const admin = await signInAdmin(ctx, 'GENERAL');

    const { body: stats } = await admin.get('/api/v1/admin/ai-usage').query({ days: 7 }).expect(200);
    expect(stats).toMatchObject({
      days: 7,
      totals: { calls: 1, failures: 0 },
      byTask: [expect.objectContaining({ task: 'interview-questions.v1', calls: 1 })],
      topUsers: [expect.objectContaining({ userId: user.id, calls: 1 })],
      defaultQuota: 50,
    });
    expect(stats.byDay).toHaveLength(7);
    expect(stats.byDay.at(-1).calls).toBe(1);

    const { body: detail } = await admin
      .patch(`/api/v1/admin/users/${user.id}/ai-quota`)
      .send({ aiDailyQuota: 5 })
      .expect(200);
    expect(detail.ai).toEqual({ callsInWindow: 1, limit: 5, override: 5 });
    await admin.patch(`/api/v1/admin/users/${user.id}/ai-quota`).send({ aiDailyQuota: null }).expect(200);
    expect((await userAgent.get('/api/v1/ai/quota').expect(200)).body.limit).toBe(50);

    await userAgent.get('/api/v1/admin/ai-usage').expect(403);
  });

  it('gives admins no limit', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    expect((await admin.get('/api/v1/ai/quota').expect(200)).body.limit).toBeNull();
  });
});

describe('admin industries', () => {
  it('adds, renames and deletes industries, protecting ones in use', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    const created = await admin
      .post('/api/v1/admin/industries')
      .send({ code: 'Game-Dev', nameVi: 'Phát triển game', nameEn: 'Game development' })
      .expect(201);
    expect(created.body).toMatchObject({ code: 'game-dev', profileCount: 0 });

    const dup = await admin
      .post('/api/v1/admin/industries')
      .send({ code: 'game-dev', nameVi: 'x', nameEn: 'x' })
      .expect(409);
    expect(dup.body.code).toBe(ErrorCode.TAXONOMY_CODE_TAKEN);

    await admin
      .patch('/api/v1/admin/industries/game-dev')
      .send({ nameVi: 'Lập trình game', nameEn: 'Game programming' })
      .expect(200)
      .expect(({ body }) => expect(body.nameVi).toBe('Lập trình game'));

    // 'software' is used by the onboarded user's profile.
    await signUpOnboarded(ctx);
    const inUse = await admin.delete('/api/v1/admin/industries/software').expect(409);
    expect(inUse.body.code).toBe(ErrorCode.TAXONOMY_IN_USE);

    await admin.delete('/api/v1/admin/industries/game-dev').expect(204);
    const list = await admin.get('/api/v1/admin/industries').expect(200);
    expect(list.body.find((industry: { code: string }) => industry.code === 'software').profileCount).toBe(1);
    expect(list.body.some((industry: { code: string }) => industry.code === 'game-dev')).toBe(false);
  });

  it('answers "code taken" to the second of two simultaneous adds of the same code', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    // Industries survive the database reset between tests (they are seeded taxonomy).
    await ctx.prisma.industry.deleteMany({ where: { code: 'quantum-lab' } });
    const add = () =>
      admin
        .post('/api/v1/admin/industries')
        .send({ code: 'quantum-lab', nameVi: 'Lượng tử', nameEn: 'Quantum' });
    const responses = await Promise.all([add(), add()]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.code).toBe(
      ErrorCode.TAXONOMY_CODE_TAKEN,
    );
    await ctx.prisma.industry.deleteMany({ where: { code: 'quantum-lab' } });
  });
});
