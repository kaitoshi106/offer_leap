import { ErrorCode } from '@offerleap/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { StorageService } from '../src/storage/storage.service';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signInAdmin,
  signUpAndVerify,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

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

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const NOTE =
  'Dự án GraphQL cho sàn thương mại điện tử: API với Apollo, React và TypeScript, kiểm thử Playwright.';

/** A user with a CV, an uploaded document and an application. */
async function userWithData() {
  const agent = await signUpOnboarded(ctx);
  await agent.post('/api/v1/resumes').attach('file', PDF, 'cv.pdf').expect(202);
  await agent.post('/api/v1/knowledge/upload').attach('file', Buffer.from(NOTE), 'du-an.txt').expect(202);
  await agent
    .post('/api/v1/applications')
    .send({ company: 'Acme', jobTitle: 'Frontend Engineer' })
    .expect(201);
  return agent;
}

describe('data export', () => {
  it('downloads everything the user created, without internal fields', async () => {
    const agent = await userWithData();

    const response = await agent.get('/api/v1/account/export').expect(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="offerleap-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      version: 1,
      account: { email: 'minh@example.com', role: 'USER' },
      profile: { jobTitle: 'Frontend Developer', workTypes: ['REMOTE'] },
      resumes: [{ fileName: 'cv.pdf' }],
      applications: [{ company: 'Acme' }],
      documents: [{ title: 'du-an', fileName: 'du-an.txt' }],
    });
    const text = JSON.stringify(response.body);
    for (const secret of ['passwordHash', 'storageKey', 'embedding', 'tokenHash'])
      expect(text).not.toContain(secret);
  });

  it('works before onboarding and only for signed-in users', async () => {
    const agent = await signUpAndVerify(ctx);
    const { body } = await agent.get('/api/v1/account/export').expect(200);
    expect(body).toMatchObject({ account: { onboardingCompleted: false }, resumes: [], analyses: [] });

    const admin = await signInAdmin(ctx, 'GENERAL');
    expect((await admin.get('/api/v1/account/export').expect(200)).body.profile).toBeNull();
  });
});

describe('account deletion', () => {
  it('needs the password, then deletes the data and files and signs out', async () => {
    const agent = await userWithData();
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'minh@example.com' } });
    const files = [
      ...(await ctx.prisma.resume.findMany({ where: { userId: user.id } })),
      ...(await ctx.prisma.knowledgeDocument.findMany({ where: { userId: user.id } })),
    ].map((row) => row.storageKey!);
    expect(files).toHaveLength(2);

    await agent.delete('/api/v1/account').send({}).expect(422);
    const wrong = await agent.delete('/api/v1/account').send({ password: 'not-my-password' }).expect(401);
    expect(wrong.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);

    const response = await agent.delete('/api/v1/account').send({ password: 'leap2026' }).expect(204);
    expect(String(response.headers['set-cookie'])).toMatch(/ol_at=;/);

    expect(await ctx.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await ctx.prisma.jobApplication.count({ where: { userId: user.id } })).toBe(0);
    expect(await ctx.prisma.knowledgeChunk.count({ where: { userId: user.id } })).toBe(0);
    const storage = ctx.app.get(StorageService);
    for (const key of files) await expect(storage.get(key)).rejects.toThrow();

    // The email is free again, and the old session is gone.
    await agent.get('/api/v1/auth/me').expect(401);
    await signUpAndVerify(ctx);
  });

  it('refuses the root admin but lets a general admin leave', async () => {
    const root = await signInAdmin(ctx, 'ROOT');
    const refused = await root.delete('/api/v1/account').send({ password: 'admin-pass-2026' }).expect(403);
    expect(refused.body.code).toBe(ErrorCode.AUTH_ACCOUNT_DELETE_NOT_ALLOWED);

    const general = await signInAdmin(ctx, 'GENERAL');
    await general.delete('/api/v1/account').send({ password: 'admin-pass-2026' }).expect(204);
    expect(await ctx.prisma.user.count({ where: { adminLevel: 'GENERAL' } })).toBe(0);
  });
});
