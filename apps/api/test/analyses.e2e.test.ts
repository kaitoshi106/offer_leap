import { ErrorCode, RESUME_FINAL_STATUSES, type AnalysisDetail } from '@offerleap/shared';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiInvalidOutputError } from '../src/modules/ai/ai.errors';
import type { AiProvider } from '../src/modules/ai/ai.types';
import { MockAiProvider } from '../src/modules/ai/providers/mock.provider';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpAndVerify,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const JOB = `Acme Tech is hiring a Senior Frontend Engineer.
Requirements: 5+ years with React and TypeScript, GraphQL, testing with Playwright.
Nice to have: Next.js, design systems.`;

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
});

/** Uploads a CV and waits until it is parsed, returning its id. */
async function uploadResume(agent: TestAgent): Promise<string> {
  const { body } = await agent.post('/api/v1/resumes').attach('file', PDF, 'cv.pdf').expect(202);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body: resume } = await agent.get(`/api/v1/resumes/${body.id}`).expect(200);
    if (RESUME_FINAL_STATUSES.includes(resume.status)) return body.id;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Resume was not processed in time');
}

async function waitForAnalysis(agent: TestAgent, id: string): Promise<AnalysisDetail> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await agent.get(`/api/v1/analyses/${id}`).expect(200);
    if (RESUME_FINAL_STATUSES.includes(body.status)) return body;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Analysis was not processed in time');
}

describe('analyses', () => {
  it('compares a CV with a job description in the background', async () => {
    const agent = await signUpOnboarded(ctx);
    const resumeId = await uploadResume(agent);
    ai.generateJson.mockClear();

    const created = await agent
      .post('/api/v1/analyses')
      .send({ resumeId, jobDescription: JOB, locale: 'en' })
      .expect(202);
    expect(created.body).toMatchObject({
      status: 'PENDING',
      score: null,
      resumeFileName: 'cv.pdf',
      locale: 'en',
    });

    const done = await waitForAnalysis(agent, created.body.id);
    expect(done).toMatchObject({
      status: 'COMPLETED',
      jobTitle: 'Senior Frontend Engineer',
      company: 'Acme Tech',
      score: 72,
      result: { score: 72, missingSkills: [{ name: 'GraphQL', importance: 'REQUIRED' }, expect.anything()] },
    });

    // The job description and the CV file go to the model, and it is told to answer in English.
    const request = ai.generateJson.mock.calls[0]![0];
    expect(request.task).toBe('job-match.v2');
    expect(request.system).toContain('in English');
    expect(request.parts[0].text).toBe(`<job>\n${JOB}\n</job>`);
    expect(request.parts[2]).toMatchObject({ type: 'file', mimeType: 'application/pdf' });

    const list = await agent.get('/api/v1/analyses').expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: done.id, score: 72, jobTitle: 'Senior Frontend Engineer' }),
    ]);
    expect(list.body[0]).not.toHaveProperty('jobDescription');
  });

  it('lists the CVs to choose from', async () => {
    const agent = await signUpOnboarded(ctx);
    const first = await uploadResume(agent);
    const second = await uploadResume(agent);
    const { body } = await agent.get('/api/v1/resumes').expect(200);
    expect(body.map((resume: { id: string }) => resume.id)).toEqual([second, first]);
  });

  it('validates the request', async () => {
    const agent = await signUpOnboarded(ctx);
    const short = await agent
      .post('/api/v1/analyses')
      .send({ resumeId: 'x', jobDescription: 'React dev', locale: 'vi' })
      .expect(422);
    expect(short.body.fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'jobDescription', rule: 'tooShort' }),
    );

    // Someone else's CV looks like an unknown one.
    const other = await signUpOnboarded(ctx, 'other@example.com');
    const otherResume = await uploadResume(other);
    const foreign = await agent
      .post('/api/v1/analyses')
      .send({ resumeId: otherResume, jobDescription: JOB, locale: 'vi' })
      .expect(422);
    expect(foreign.body.fieldErrors).toEqual([{ field: 'resumeId', rule: 'invalid' }]);
  });

  it('needs a finished profile', async () => {
    const agent = await signUpAndVerify(ctx);
    const response = await agent.get('/api/v1/analyses').expect(403);
    expect(response.body.code).toBe(ErrorCode.ONBOARDING_REQUIRED);
  });

  it('marks the analysis as failed when the AI answer is unusable', async () => {
    const agent = await signUpOnboarded(ctx);
    const resumeId = await uploadResume(agent);
    ai.generateJson.mockRejectedValue(new AiInvalidOutputError('nonsense'));

    const { body } = await agent
      .post('/api/v1/analyses')
      .send({ resumeId, jobDescription: JOB, locale: 'vi' })
      .expect(202);
    expect(await waitForAnalysis(agent, body.id)).toMatchObject({
      status: 'FAILED',
      errorCode: ErrorCode.ANALYSIS_FAILED,
      result: null,
    });
  });

  it("hides and protects other users' analyses", async () => {
    const owner = await signUpOnboarded(ctx, 'owner@example.com');
    const resumeId = await uploadResume(owner);
    const { body } = await owner
      .post('/api/v1/analyses')
      .send({ resumeId, jobDescription: JOB, locale: 'vi' })
      .expect(202);
    await waitForAnalysis(owner, body.id);

    const other = await signUpOnboarded(ctx, 'other@example.com');
    await other.get(`/api/v1/analyses/${body.id}`).expect(404);
    await other.delete(`/api/v1/analyses/${body.id}`).expect(404);
    expect((await other.get('/api/v1/analyses').expect(200)).body).toEqual([]);

    await owner.delete(`/api/v1/analyses/${body.id}`).expect(204);
    await owner.get(`/api/v1/analyses/${body.id}`).expect(404);
  });
});
