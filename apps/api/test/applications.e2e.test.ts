import { ErrorCode } from '@offerleap/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiUnavailableError } from '../src/modules/ai/ai.errors';
import type { AiProvider } from '../src/modules/ai/ai.types';
import { MockAiProvider } from '../src/modules/ai/providers/mock.provider';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

const JOB = `Acme Tech is hiring a Senior Frontend Engineer.
Requirements: 5+ years with React and TypeScript, GraphQL, testing with Playwright. Nice to have: Next.js.`;

const ai = { name: 'test', generateJson: vi.fn(), streamText: vi.fn() } satisfies AiProvider;
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
  ai.streamText.mockReset().mockImplementation((request) => mock.streamText(request));
});

describe('applications', () => {
  it('tracks applications on a board: create, edit, move, delete', async () => {
    const agent = await signUpOnboarded(ctx);
    const create = (body: object) => agent.post('/api/v1/applications').send(body).expect(201);

    const first = await create({
      company: 'Acme',
      jobTitle: 'Frontend Engineer',
      jobUrl: 'https://acme.dev/jobs/1',
    });
    const second = await create({ company: 'Globex', jobTitle: 'React Developer' });
    expect(first.body).toMatchObject({
      status: 'SAVED',
      jobUrl: 'https://acme.dev/jobs/1',
      hasCoverLetter: false,
    });
    // New cards go on top of their column.
    expect(second.body.position).toBeLessThan(first.body.position);

    await agent
      .patch(`/api/v1/applications/${first.body.id}`)
      .send({ notes: 'Referral from Lan', jobUrl: '' })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ notes: 'Referral from Lan', jobUrl: null }));

    await agent
      .patch(`/api/v1/applications/${first.body.id}/move`)
      .send({ status: 'INTERVIEW', position: 0.5 })
      .expect(200);

    const board = await agent.get('/api/v1/applications').expect(200);
    expect(
      board.body.map((card: { company: string; status: string }) => [card.company, card.status]),
    ).toEqual([
      ['Globex', 'SAVED'],
      ['Acme', 'INTERVIEW'],
    ]);

    await agent.delete(`/api/v1/applications/${second.body.id}`).expect(204);
    expect((await agent.get('/api/v1/applications').expect(200)).body).toHaveLength(1);
  });

  it('validates input', async () => {
    const agent = await signUpOnboarded(ctx);
    const response = await agent
      .post('/api/v1/applications')
      .send({ company: '', jobTitle: 'Dev', jobUrl: 'javascript:alert(1)' })
      .expect(422);
    expect(response.body.fieldErrors.map((error: { field: string }) => error.field)).toEqual([
      'company',
      'jobUrl',
    ]);
  });

  it('can be created from an analysis, copying its job description and score', async () => {
    const agent = await signUpOnboarded(ctx);
    const user = await ctx.prisma.user.findFirstOrThrow();
    const resume = await ctx.prisma.resume.create({
      data: {
        userId: user.id,
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        storageKey: 'x/cv.pdf',
      },
    });
    const analysis = await ctx.prisma.jobAnalysis.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        jobDescription: JOB,
        locale: 'en',
        status: 'COMPLETED',
        score: 72,
      },
    });

    const { body } = await agent
      .post('/api/v1/applications')
      .send({ company: 'Acme Tech', jobTitle: 'Senior Frontend Engineer', analysisId: analysis.id })
      .expect(201);
    expect(body).toMatchObject({ jobDescription: JOB, analysisId: analysis.id, score: 72 });

    const other = await signUpOnboarded(ctx, 'other@example.com');
    const foreign = await other
      .post('/api/v1/applications')
      .send({ company: 'Acme Tech', jobTitle: 'Dev', analysisId: analysis.id })
      .expect(422);
    expect(foreign.body.fieldErrors).toEqual([{ field: 'analysisId', rule: 'invalid' }]);
  });

  it('streams a cover letter and saves it when finished', async () => {
    const agent = await signUpOnboarded(ctx);
    const { body: application } = await agent
      .post('/api/v1/applications')
      .send({ company: 'Acme Tech', jobTitle: 'Senior Frontend Engineer', jobDescription: JOB })
      .expect(201);

    const response = await agent
      .post(`/api/v1/applications/${application.id}/cover-letter`)
      .send({ locale: 'en' })
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => done(null, text));
      })
      .expect(200)
      .expect('Content-Type', /text\/plain/);

    expect(response.body).toMatch(/^Dear Hiring Team,[\s\S]*Nguyễn Văn An$/);
    const request = ai.streamText.mock.calls[0]![0];
    expect(request.task).toBe('cover-letter.v1');
    expect(request.system).toContain('Write in English');
    expect(request.parts[0].text).toContain('Name: Trần Minh');
    expect(request.parts[1].text).toContain('Company: Acme Tech');

    const saved = await agent.get(`/api/v1/applications/${application.id}`).expect(200);
    expect(saved.body).toMatchObject({ coverLetter: response.body.trim(), hasCoverLetter: true });
  });

  it('needs a job description and an available AI before streaming', async () => {
    const agent = await signUpOnboarded(ctx);
    const { body: bare } = await agent
      .post('/api/v1/applications')
      .send({ company: 'Acme', jobTitle: 'Dev' })
      .expect(201);
    const missing = await agent
      .post(`/api/v1/applications/${bare.id}/cover-letter`)
      .send({ locale: 'vi' })
      .expect(422);
    expect(missing.body.fieldErrors).toEqual([{ field: 'jobDescription', rule: 'required' }]);

    await agent.patch(`/api/v1/applications/${bare.id}`).send({ jobDescription: JOB }).expect(200);
    ai.streamText.mockRejectedValueOnce(new AiUnavailableError('busy'));
    const busy = await agent
      .post(`/api/v1/applications/${bare.id}/cover-letter`)
      .send({ locale: 'vi' })
      .expect(503);
    expect(busy.body.code).toBe(ErrorCode.AI_UNAVAILABLE);
  });

  it("hides other users' applications", async () => {
    const owner = await signUpOnboarded(ctx, 'owner@example.com');
    const { body } = await owner
      .post('/api/v1/applications')
      .send({ company: 'Acme', jobTitle: 'Dev' })
      .expect(201);

    const other = await signUpOnboarded(ctx, 'other@example.com');
    await other.get(`/api/v1/applications/${body.id}`).expect(404);
    await other.patch(`/api/v1/applications/${body.id}`).send({ notes: 'x' }).expect(404);
    await other
      .patch(`/api/v1/applications/${body.id}/move`)
      .send({ status: 'OFFER', position: 0 })
      .expect(404);
    await other.post(`/api/v1/applications/${body.id}/cover-letter`).send({ locale: 'vi' }).expect(404);
    await other.delete(`/api/v1/applications/${body.id}`).expect(404);
    expect((await other.get('/api/v1/applications').expect(200)).body).toEqual([]);
  });
});
