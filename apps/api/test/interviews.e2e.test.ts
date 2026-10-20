import { ErrorCode } from '@offerleap/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiInvalidOutputError, AiUnavailableError } from '../src/modules/ai/ai.errors';
import type { AiProvider } from '../src/modules/ai/ai.types';
import { MockAiProvider } from '../src/modules/ai/providers/mock.provider';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

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
});

const START = { jobTitle: 'Senior Frontend Engineer', type: 'MIXED', questionCount: 3, locale: 'en' };

describe('mock interviews', () => {
  it('runs a whole interview: questions, feedback per answer, summary', async () => {
    const agent = await signUpOnboarded(ctx);

    const { body: started } = await agent.post('/api/v1/interviews').send(START).expect(201);
    expect(started).toMatchObject({
      status: 'IN_PROGRESS',
      questionCount: 3,
      answeredCount: 0,
      result: null,
    });
    expect(started.questions.map((q: { index: number; focus: string }) => [q.index, q.focus])).toEqual([
      [0, 'Ownership'],
      [1, 'Performance'],
      [2, 'Collaboration'],
    ]);
    // The prompt is built from the job and the candidate's profile.
    const questionsRequest = ai.generateJson.mock.calls[0]![0];
    expect(questionsRequest.task).toBe('interview-questions.v1');
    expect(questionsRequest.system).toContain('Write exactly 3 a mix');
    expect(questionsRequest.parts[0].text).toContain('Skills: React');

    const base = `/api/v1/interviews/${started.id}`;
    const { body: afterFirst } = await agent
      .post(`${base}/questions/0/answer`)
      .send({ answer: 'I led the migration of our app to Next.js.' })
      .expect(200);
    expect(afterFirst.questions[0]).toMatchObject({
      score: 7,
      answer: 'I led the migration of our app to Next.js.',
    });
    expect(afterFirst.questions[0].betterAnswer).toMatch(/^In a previous project/);
    expect(afterFirst.answeredCount).toBe(1);

    // Finishing early is refused.
    const early = await agent.post(`${base}/complete`).expect(409);
    expect(early.body.code).toBe(ErrorCode.INTERVIEW_NOT_FINISHED);

    await agent.post(`${base}/questions/1/skip`).expect(200);
    await agent.post(`${base}/questions/2/answer`).send({ answer: 'We talked it through.' }).expect(200);

    const { body: done } = await agent.post(`${base}/complete`).expect(200);
    expect(done).toMatchObject({
      status: 'COMPLETED',
      overallScore: 68,
      result: { strengths: expect.any(Array) },
    });
    expect(done.questions[1]).toMatchObject({ skipped: true, score: 0, answer: null });
    // The summary sees the skipped question as such.
    expect(ai.generateJson.mock.calls.at(-1)![0].parts[0].text).toContain('(skipped)');

    const list = await agent.get('/api/v1/interviews').expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: started.id, overallScore: 68, answeredCount: 3 }),
    ]);
  });

  it('refuses to answer a question twice or after the interview is completed', async () => {
    const agent = await signUpOnboarded(ctx);
    const { body } = await agent.post('/api/v1/interviews').send(START).expect(201);
    const base = `/api/v1/interviews/${body.id}`;

    await agent.post(`${base}/questions/0/answer`).send({ answer: 'First' }).expect(200);
    const again = await agent.post(`${base}/questions/0/answer`).send({ answer: 'Second' }).expect(409);
    expect(again.body.code).toBe(ErrorCode.INTERVIEW_ALREADY_ANSWERED);
    await agent.post(`${base}/questions/9/skip`).expect(404);

    await agent.post(`${base}/questions/1/skip`).expect(200);
    await agent.post(`${base}/questions/2/skip`).expect(200);
    await agent.post(`${base}/complete`).expect(200);
    // Completing again is harmless.
    await agent.post(`${base}/complete`).expect(200);
    expect(
      ai.generateJson.mock.calls.filter(([request]) => request.task === 'interview-summary.v1'),
    ).toHaveLength(1);

    const late = await agent.post(`${base}/questions/0/skip`).expect(409);
    expect(late.body.code).toBe(ErrorCode.INTERVIEW_ALREADY_COMPLETED);
  });

  it('uses the job description of a tracked application', async () => {
    const agent = await signUpOnboarded(ctx);
    const jobDescription = 'Acme needs a React engineer who knows GraphQL and accessibility.';
    const { body: application } = await agent
      .post('/api/v1/applications')
      .send({ company: 'Acme', jobTitle: 'React Engineer', jobDescription })
      .expect(201);

    const { body } = await agent
      .post('/api/v1/interviews')
      .send({ ...START, jobTitle: 'React Engineer', applicationId: application.id })
      .expect(201);
    expect(body).toMatchObject({ applicationId: application.id, jobDescription });
    expect(ai.generateJson.mock.calls[0]![0].parts[0].text).toContain('GraphQL and accessibility');

    const other = await signUpOnboarded(ctx, 'other@example.com');
    const foreign = await other
      .post('/api/v1/interviews')
      .send({ ...START, applicationId: application.id })
      .expect(422);
    expect(foreign.body.fieldErrors).toEqual([{ field: 'applicationId', rule: 'invalid' }]);
  });

  it('reports AI problems without saving anything', async () => {
    const agent = await signUpOnboarded(ctx);
    ai.generateJson.mockRejectedValueOnce(new AiUnavailableError('busy'));
    expect((await agent.post('/api/v1/interviews').send(START).expect(503)).body.code).toBe(
      ErrorCode.AI_UNAVAILABLE,
    );
    expect(await ctx.prisma.interviewSession.count()).toBe(0);

    const { body } = await agent.post('/api/v1/interviews').send(START).expect(201);
    ai.generateJson.mockRejectedValueOnce(new AiInvalidOutputError('nonsense'));
    const failed = await agent
      .post(`/api/v1/interviews/${body.id}/questions/0/answer`)
      .send({ answer: 'My answer' })
      .expect(502);
    expect(failed.body.code).toBe(ErrorCode.AI_FAILED);
    // The question stays open, so the user can retry.
    await agent
      .post(`/api/v1/interviews/${body.id}/questions/0/answer`)
      .send({ answer: 'My answer' })
      .expect(200);
  });

  it("hides other users' interviews", async () => {
    const owner = await signUpOnboarded(ctx, 'owner@example.com');
    const { body } = await owner.post('/api/v1/interviews').send(START).expect(201);

    const other = await signUpOnboarded(ctx, 'other@example.com');
    await other.get(`/api/v1/interviews/${body.id}`).expect(404);
    await other.post(`/api/v1/interviews/${body.id}/questions/0/answer`).send({ answer: 'x' }).expect(404);
    await other.post(`/api/v1/interviews/${body.id}/complete`).expect(404);
    await other.delete(`/api/v1/interviews/${body.id}`).expect(404);

    await owner.delete(`/api/v1/interviews/${body.id}`).expect(204);
    expect(await ctx.prisma.interviewQuestion.count()).toBe(0);
  });
});
