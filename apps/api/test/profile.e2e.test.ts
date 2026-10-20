import { ErrorCode } from '@offerleap/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
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

describe('profile page', () => {
  it('edits one section at a time with the onboarding rules', async () => {
    const agent = await signUpOnboarded(ctx);

    const { body } = await agent
      .put('/api/v1/profile/sections')
      .send({
        section: 'career',
        values: {
          industryCode: 'data-ai',
          jobTitle: 'Data Engineer',
          level: 'MIDDLE',
          yearsOfExperience: 4,
          skills: ['Python', 'SQL'],
        },
      })
      .expect(200);
    expect(body).toMatchObject({
      jobTitle: 'Data Engineer',
      industryCode: 'data-ai',
      skills: ['Python', 'SQL'],
    });
    // Other sections are untouched.
    expect(body).toMatchObject({ fullName: 'Trần Minh', provinceCode: 'ha-noi', workTypes: ['REMOTE'] });

    await agent
      .put('/api/v1/profile/sections')
      .send({
        section: 'personal',
        values: { fullName: 'Trần Văn Minh', phone: '+84 912 345 678', provinceCode: 'da-nang' },
      })
      .expect(200)
      .expect(({ body: personal }) =>
        expect(personal).toMatchObject({ fullName: 'Trần Văn Minh', phone: '0912345678' }),
      );
    // The name is the account name too.
    expect((await agent.get('/api/v1/auth/me').expect(200)).body.fullName).toBe('Trần Văn Minh');

    const invalid = await agent
      .put('/api/v1/profile/sections')
      .send({ section: 'personal', values: { fullName: 'Minh', provinceCode: 'atlantis' } })
      .expect(422);
    expect(invalid.body.fieldErrors).toEqual([{ field: 'provinceCode', rule: 'invalid' }]);
  });

  it('is only for completed profiles', async () => {
    const agent = await signUpAndVerify(ctx);
    const response = await agent
      .put('/api/v1/profile/sections')
      .send({ section: 'preferences', values: { workTypes: ['REMOTE'] } })
      .expect(403);
    expect(response.body.code).toBe(ErrorCode.ONBOARDING_REQUIRED);
  });
});

describe('CV management', () => {
  it('lists CVs with their analyses and deletes a CV with them', async () => {
    const agent = await signUpOnboarded(ctx);
    const { body: resume } = await agent.post('/api/v1/resumes').attach('file', PDF, 'cv.pdf').expect(202);
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'USER' } });
    const analysis = await ctx.prisma.jobAnalysis.create({
      data: { userId: user.id, resumeId: resume.id, jobDescription: 'x'.repeat(120), locale: 'vi' },
    });
    const application = await ctx.prisma.jobApplication.create({
      data: { userId: user.id, company: 'Acme', jobTitle: 'Dev', position: 0, analysisId: analysis.id },
    });

    const list = await agent.get('/api/v1/resumes').expect(200);
    expect(list.body[0]).toMatchObject({ id: resume.id, analysisCount: 1 });

    await agent.delete(`/api/v1/resumes/${resume.id}`).expect(204);
    expect(await ctx.prisma.jobAnalysis.count()).toBe(0);
    // The application stays, unlinked from the deleted analysis.
    expect(await ctx.prisma.jobApplication.findUnique({ where: { id: application.id } })).toMatchObject({
      analysisId: null,
    });

    const other = await signUpOnboarded(ctx, 'other@example.com');
    const { body: theirs } = await other.post('/api/v1/resumes').attach('file', PDF, 'cv.pdf').expect(202);
    await agent.delete(`/api/v1/resumes/${theirs.id}`).expect(404);
  });
});
