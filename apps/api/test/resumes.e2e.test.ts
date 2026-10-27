import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ErrorCode,
  RESUME_FINAL_STATUSES,
  RESUME_MAX_BYTES,
  RESUME_MAX_PER_USER,
  type ResumeSummary,
} from '@offerleap/shared';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiInvalidOutputError, AiUnavailableError } from '../src/modules/ai/ai.errors';
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

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
/** A different PDF each time (the API returns the existing CV for a file it already has). */
const pdfNumbered = (n: number) => Buffer.concat([PDF, Buffer.from(`% copy ${n}\n`)]);

/** Delegates to the mock by default; individual tests swap in failures. */
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

const upload = (agent: TestAgent, data: Buffer, fileName: string) =>
  agent.post('/api/v1/resumes').attach('file', data, fileName);

/** Polls like the web app does until the worker has finished the job. */
async function waitForResult(agent: TestAgent, id: string): Promise<ResumeSummary> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await agent.get(`/api/v1/resumes/${id}`).expect(200);
    if (RESUME_FINAL_STATUSES.includes(body.status)) return body;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Resume was not processed in time');
}

describe('resumes', () => {
  it('parses an uploaded PDF in the background and suggests profile values', async () => {
    const agent = await signUpAndVerify(ctx);

    const accepted = await upload(agent, PDF, 'CV Nguyễn Văn An.pdf').expect(202);
    expect(accepted.body).toMatchObject({
      fileName: 'CV Nguyễn Văn An.pdf',
      status: 'PENDING',
      suggestions: null,
    });

    const parsed = await waitForResult(agent, accepted.body.id);
    expect(parsed.status).toBe('COMPLETED');
    expect(parsed.suggestions).toMatchObject({
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      provinceCode: 'ha-noi',
      industryCode: 'software',
      level: 'SENIOR',
      uncertainFields: ['phone'],
    });

    // The PDF goes to the model as a file, after the taxonomy reference.
    const request = ai.generateJson.mock.calls[0]![0];
    expect(request.task).toBe('resume-extraction.v2');
    expect(request.system).toContain(`Today's date is ${new Date().toISOString().slice(0, 10)}`);
    expect(request.parts[1]).toMatchObject({ type: 'file', mimeType: 'application/pdf' });
    expect(request.parts[0].text).toContain('ha-noi: Hà Nội / Hanoi');

    const row = await ctx.prisma.resume.findUniqueOrThrow({ where: { id: parsed.id } });
    expect(row).toMatchObject({ aiModel: 'mock', mimeType: 'application/pdf' });

    // Onboarding exposes the latest CV so the wizard can pre-fill its steps.
    const state = await agent.get('/api/v1/onboarding').expect(200);
    expect(state.body).toMatchObject({ step: 'resume', resume: { id: parsed.id, status: 'COMPLETED' } });
  });

  it('overwrites what the user already filled with the values read from the CV', async () => {
    const agent = await signUpAndVerify(ctx);
    const draft = (step: string, values: object) =>
      agent.put('/api/v1/onboarding/draft').send({ step, values }).expect(200);
    await draft('personal', { fullName: 'Trần Minh', phone: '0987 000 111', provinceCode: 'da-nang' });
    await draft('career', {
      industryCode: 'marketing',
      jobTitle: 'Content Writer',
      level: 'JUNIOR',
      yearsOfExperience: 1,
      skills: ['SEO'],
    });
    await draft('preferences', { expectedSalaryMin: 20, workTypes: ['REMOTE'] });

    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);
    await waitForResult(agent, body.id);

    const state = await agent.get('/api/v1/onboarding').expect(200);
    expect(state.body.values).toEqual({
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      provinceCode: 'ha-noi',
      industryCode: 'software',
      jobTitle: 'Frontend Developer',
      level: 'SENIOR',
      yearsOfExperience: 6,
      skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Node.js'],
      // Not in a CV: kept as the user entered them.
      expectedSalaryMin: 20,
      expectedSalaryMax: null,
      workTypes: ['REMOTE'],
    });
    // The resume point is untouched: the user continues where they were.
    expect(state.body.step).toBe('review');
  });

  it('keeps fields the AI could not read', async () => {
    ai.generateJson.mockImplementation(async (request) => {
      const result = await mock.generateJson(request);
      return { ...result, data: { ...(result.data as object), phone: null, skills: [] } as never };
    });
    const agent = await signUpAndVerify(ctx);
    await agent
      .put('/api/v1/onboarding/draft')
      .send({
        step: 'personal',
        values: { fullName: 'Trần Minh', phone: '0987000111', provinceCode: 'da-nang' },
      })
      .expect(200);

    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);
    await waitForResult(agent, body.id);

    const { body: state } = await agent.get('/api/v1/onboarding').expect(200);
    expect(state.values).toMatchObject({ phone: '0987000111', provinceCode: 'ha-noi', skills: [] });
  });

  it('sends DOCX files as extracted text inside <cv> tags', async () => {
    const agent = await signUpAndVerify(ctx);
    const { body } = await upload(agent, fixture('resume.docx'), 'cv.docx').expect(202);

    expect((await waitForResult(agent, body.id)).status).toBe('COMPLETED');
    const [part] = ai.generateJson.mock.calls[0]![0].parts;
    expect(part).toMatchObject({ type: 'text' });
    expect(part.text).toMatch(/<cv>\nNguyễn Văn An[\s\S]*Kỹ năng: React[\s\S]*<\/cv>$/);
  });

  it('checks the file contents, not the name', async () => {
    const agent = await signUpAndVerify(ctx);
    const response = await upload(agent, Buffer.from('just some text'), 'cv.pdf').expect(415);
    expect(response.body.code).toBe(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE);
    expect(await ctx.prisma.resume.count()).toBe(0);
  });

  it('refuses an upload from a deleted account without leaving its file behind', async () => {
    const agent = await signUpAndVerify(ctx);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'minh@example.com' } });
    // Deleted while its access token is still valid (it lives a few minutes).
    await ctx.prisma.user.delete({ where: { id: user.id } });

    const response = await upload(agent, PDF, 'cv.pdf').expect(401);
    expect(response.body.code).toBe(ErrorCode.AUTH_UNAUTHENTICATED);
    const folder = join(process.cwd(), 'storage/test/resumes', user.id);
    expect(existsSync(folder) ? readdirSync(folder) : []).toEqual([]);
  });

  it('rejects files over the size limit and requests without a file', async () => {
    const agent = await signUpAndVerify(ctx);
    const big = Buffer.concat([PDF, Buffer.alloc(RESUME_MAX_BYTES)]);
    expect((await upload(agent, big, 'cv.pdf').expect(413)).body.code).toBe(ErrorCode.COMMON_FILE_TOO_LARGE);

    const missing = await agent.post('/api/v1/resumes').expect(422);
    expect(missing.body.fieldErrors).toEqual([{ field: 'file', rule: 'required' }]);
  });

  it('marks the CV as failed when the AI answer is unusable, without retrying', async () => {
    ai.generateJson.mockRejectedValue(new AiInvalidOutputError('nonsense'));
    const agent = await signUpAndVerify(ctx);
    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);

    const result = await waitForResult(agent, body.id);
    expect(result).toMatchObject({
      status: 'FAILED',
      errorCode: ErrorCode.RESUME_PARSE_FAILED,
      suggestions: null,
    });
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });

  it('fails an empty DOCX without calling the AI', async () => {
    const agent = await signUpAndVerify(ctx);
    const { body } = await upload(agent, fixture('empty.docx'), 'cv.docx').expect(202);

    expect(await waitForResult(agent, body.id)).toMatchObject({ errorCode: ErrorCode.RESUME_PARSE_FAILED });
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('retries while the AI is unavailable', async () => {
    ai.generateJson.mockRejectedValueOnce(new AiUnavailableError('busy'));
    const agent = await signUpAndVerify(ctx);
    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);

    // First attempt fails, BullMQ waits out the backoff (5 s) and the second attempt succeeds.
    const result = await waitForResult(agent, body.id);
    expect(result.status).toBe('COMPLETED');
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("hides other users' CVs", async () => {
    const owner = await signUpAndVerify(ctx, 'owner@example.com');
    const { body } = await upload(owner, PDF, 'cv.pdf').expect(202);
    await waitForResult(owner, body.id);

    const other = await signUpAndVerify(ctx, 'other@example.com');
    const response = await other.get(`/api/v1/resumes/${body.id}`).expect(404);
    expect(response.body.code).toBe(ErrorCode.COMMON_NOT_FOUND);
  });

  it('only stores CVs uploaded after onboarding, without asking the AI', async () => {
    const agent = await signUpOnboarded(ctx);
    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);

    expect(body).toMatchObject({ status: 'UPLOADED', mimeType: 'application/pdf', suggestions: null });
    expect(RESUME_FINAL_STATUSES).toContain(body.status);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('returns the existing CV when the same file is uploaded again, and moves it to the top', async () => {
    const agent = await signUpOnboarded(ctx);
    const first = await upload(agent, PDF, 'cv.pdf').expect(202);
    await upload(agent, pdfNumbered(1), 'other.pdf').expect(202);

    const again = await upload(agent, PDF, 'cv renamed.pdf').expect(202);
    expect(again.body).toMatchObject({ id: first.body.id, fileName: 'cv.pdf', reused: true });
    expect(await ctx.prisma.resume.count()).toBe(2);
    const list = await agent.get('/api/v1/resumes').expect(200);
    expect(list.body.map((resume: ResumeSummary) => resume.id)[0]).toBe(first.body.id);
    expect(list.body[0].reused).toBeUndefined();

    // Same bytes from another account are that account's own CV.
    const other = await signUpOnboarded(ctx, 'other@example.com');
    expect((await upload(other, PDF, 'cv.pdf').expect(202)).body.reused).toBeUndefined();
  });

  it('reads a CV again when its earlier reading failed during onboarding', async () => {
    ai.generateJson.mockRejectedValueOnce(new AiInvalidOutputError('nonsense'));
    const agent = await signUpAndVerify(ctx);
    const { body } = await upload(agent, PDF, 'cv.pdf').expect(202);
    expect((await waitForResult(agent, body.id)).status).toBe('FAILED');

    const again = await upload(agent, PDF, 'cv.pdf').expect(202);
    expect(again.body).toMatchObject({ id: body.id, status: 'PENDING', errorCode: null, reused: true });
    expect((await waitForResult(agent, body.id)).status).toBe('COMPLETED');
  });

  it('puts the values of a CV read earlier back into the draft when it is uploaded again', async () => {
    const agent = await signUpAndVerify(ctx);
    const first = await upload(agent, PDF, 'an.pdf').expect(202);
    await waitForResult(agent, first.body.id);
    ai.generateJson.mockImplementationOnce(async (request) => {
      const result = await mock.generateJson(request);
      return { ...result, data: { ...(result.data as object), fullName: 'Trần Thị Bình' } as never };
    });
    const second = await upload(agent, pdfNumbered(1), 'binh.pdf').expect(202);
    await waitForResult(agent, second.body.id);
    const fullName = async () => (await agent.get('/api/v1/onboarding').expect(200)).body.values.fullName;
    expect(await fullName()).toBe('Trần Thị Bình');

    const again = await upload(agent, PDF, 'an.pdf').expect(202);
    expect(again.body).toMatchObject({ id: first.body.id, status: 'COMPLETED', reused: true });
    expect(await fullName()).toBe('Nguyễn Văn An');
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  });

  it(`keeps at most ${RESUME_MAX_PER_USER} CVs per user`, async () => {
    const agent = await signUpOnboarded(ctx);
    for (let n = 0; n < RESUME_MAX_PER_USER; n += 1)
      await upload(agent, pdfNumbered(n), 'cv.pdf').expect(202);

    const refused = await upload(agent, pdfNumbered(99), 'cv.pdf').expect(409);
    expect(refused.body.code).toBe(ErrorCode.RESUME_LIMIT_REACHED);
    expect(await ctx.prisma.resume.count()).toBe(RESUME_MAX_PER_USER);
    // A file the user already has is still accepted: it adds nothing.
    await upload(agent, pdfNumbered(0), 'cv.pdf').expect(202);

    const [oldest] = (await agent.get('/api/v1/resumes').expect(200)).body.slice(-1);
    await agent.delete(`/api/v1/resumes/${oldest.id}`).expect(204);
    await upload(agent, pdfNumbered(99), 'cv.pdf').expect(202);
  });

  it('replaces a CV in the same step when the user is at the limit', async () => {
    const agent = await signUpOnboarded(ctx);
    for (let n = 0; n < RESUME_MAX_PER_USER; n += 1)
      await upload(agent, pdfNumbered(n), `cv-${n}.pdf`).expect(202);
    const list = async () => (await agent.get('/api/v1/resumes').expect(200)).body as ResumeSummary[];
    const oldest = (await list()).at(-1)!;
    const { storageKey } = await ctx.prisma.resume.findUniqueOrThrow({ where: { id: oldest.id } });
    const withReplace = (agentFor: TestAgent, data: Buffer, replaceId: string) =>
      agentFor.post('/api/v1/resumes').field('replaceId', replaceId).attach('file', data, 'new.pdf');

    // Someone else's CV can't be named: nothing is deleted or stored.
    const other = await signUpOnboarded(ctx, 'other@example.com');
    const otherCv = await upload(other, pdfNumbered(50), 'other.pdf').expect(202);
    await withReplace(agent, pdfNumbered(99), otherCv.body.id).expect(404);
    expect(await ctx.prisma.resume.count({ where: { id: otherCv.body.id } })).toBe(1);
    expect((await list()).map(({ id }) => id)).toContain(oldest.id);

    // A file the user already has is reused: nothing needs to make room.
    const reused = await withReplace(agent, pdfNumbered(2), oldest.id).expect(202);
    expect(reused.body.reused).toBe(true);
    expect((await list()).map(({ id }) => id)).toContain(oldest.id);

    const created = await withReplace(agent, pdfNumbered(99), oldest.id).expect(202);
    const after = await list();
    expect(after).toHaveLength(RESUME_MAX_PER_USER);
    expect(after[0]!.id).toBe(created.body.id);
    expect(after.map(({ id }) => id)).not.toContain(oldest.id);
    expect(existsSync(join(process.cwd(), 'storage/test', storageKey))).toBe(false);
  });

  it('lets a user who already has more CVs than the limit swap one (from before the limit existed)', async () => {
    const agent = await signUpOnboarded(ctx);
    for (let n = 0; n < RESUME_MAX_PER_USER; n += 1)
      await upload(agent, pdfNumbered(n), `cv-${n}.pdf`).expect(202);
    // Older uploads, made when there was no limit.
    const { userId } = await ctx.prisma.resume.findFirstOrThrow();
    await ctx.prisma.resume.createMany({
      data: [1, 2].map((n) => ({
        userId,
        fileName: `old-${n}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        storageKey: `resumes/${userId}/old-${n}.pdf`,
        status: 'UPLOADED' as const,
        createdAt: new Date(2020, 0, n),
      })),
    });
    const oldest = (await agent.get('/api/v1/resumes').expect(200)).body.at(-1);
    expect(oldest.fileName).toBe('old-1.pdf');

    await agent
      .post('/api/v1/resumes')
      .field('replaceId', oldest.id)
      .attach('file', pdfNumbered(99), 'new.pdf')
      .expect(202);
    expect(await ctx.prisma.resume.count()).toBe(RESUME_MAX_PER_USER + 2);
    // Without a swap it still can't grow.
    await upload(agent, pdfNumbered(100), 'more.pdf').expect(409);
  });

  it('serves the uploaded file back to its owner only', async () => {
    const owner = await signUpOnboarded(ctx);
    const { body } = await upload(owner, PDF, "CV (An's).pdf").expect(202);

    const file = await owner.get(`/api/v1/resumes/${body.id}/file`).buffer(true).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toBe("inline; filename*=UTF-8''CV%20%28An%27s%29.pdf");
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.compare(file.body as Buffer, PDF)).toBe(0);

    const other = await signUpOnboarded(ctx, 'other@example.com');
    await other.get(`/api/v1/resumes/${body.id}/file`).expect(404);
    await other.get(`/api/v1/resumes/${body.id}/preview`).expect(404);
  });

  it('converts a DOCX to HTML for preview, and only DOCX', async () => {
    const agent = await signUpOnboarded(ctx);
    const docx = await upload(agent, fixture('resume.docx'), 'cv.docx').expect(202);
    const preview = await agent.get(`/api/v1/resumes/${docx.body.id}/preview`).expect(200);
    expect(preview.body.html).toContain('Nguyễn Văn An');
    expect(preview.body.html).toMatch(/^<(p|h\d)/);

    const pdf = await upload(agent, PDF, 'cv.pdf').expect(202);
    const refused = await agent.get(`/api/v1/resumes/${pdf.body.id}/preview`).expect(415);
    expect(refused.body.code).toBe(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE);
  });
});
