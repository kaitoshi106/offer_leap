import { ErrorCode } from '@offerleap/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/common/security/hashing';
import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpAndVerify,
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
  ctx.mail.sent.length = 0;
});

const PERSONAL = { fullName: 'Trần Văn Minh', phone: '0912 345 678', provinceCode: 'ha-noi' };
const CAREER = {
  industryCode: 'software',
  jobTitle: 'Senior Frontend Developer',
  level: 'SENIOR',
  yearsOfExperience: 6,
  skills: ['React', 'TypeScript', 'react'],
};
const PREFERENCES = { expectedSalaryMin: 40, expectedSalaryMax: 60, workTypes: ['REMOTE', 'HYBRID'] };

describe('taxonomies', () => {
  it('are public and cacheable', async () => {
    const provinces = await request(ctx.app.getHttpServer()).get('/api/v1/taxonomies/provinces').expect(200);
    const industries = await request(ctx.app.getHttpServer())
      .get('/api/v1/taxonomies/industries')
      .expect(200);

    expect(provinces.body).toHaveLength(34);
    expect(provinces.body.filter((p: { type: string }) => p.type === 'CITY')).toHaveLength(6);
    expect(provinces.body[0]).toEqual({ code: 'ha-noi', nameVi: 'Hà Nội', nameEn: 'Hanoi', type: 'CITY' });
    expect(industries.body.length).toBeGreaterThan(10);
    expect(provinces.headers['cache-control']).toBe('public, max-age=3600');
  });
});

describe('onboarding', () => {
  it('blocks profile APIs until onboarding is completed', async () => {
    const agent = await signUpAndVerify(ctx);
    const blocked = await agent.get('/api/v1/profile').expect(403);
    expect(blocked.body.code).toBe(ErrorCode.ONBOARDING_REQUIRED);

    // Auth and onboarding stay reachable.
    await agent.get('/api/v1/auth/me').expect(200);
    const state = await agent.get('/api/v1/onboarding').expect(200);
    expect(state.body).toMatchObject({
      step: 'personal',
      completed: false,
      values: { fullName: 'Trần Minh', skills: [] },
    });
  });

  it('walks through the steps, saving a resumable draft, and unlocks the profile', async () => {
    const agent = await signUpAndVerify(ctx);

    const afterPersonal = await agent
      .put('/api/v1/onboarding/draft')
      .send({ step: 'personal', values: PERSONAL })
      .expect(200);
    expect(afterPersonal.body).toMatchObject({
      step: 'career',
      values: { fullName: 'Trần Văn Minh', phone: '0912345678', provinceCode: 'ha-noi' },
    });

    // Finishing too early lists what is missing.
    const early = await agent.post('/api/v1/onboarding/complete').expect(422);
    expect(early.body.fieldErrors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining([
        'industryCode',
        'jobTitle',
        'level',
        'yearsOfExperience',
        'skills',
        'workTypes',
      ]),
    );

    await agent.put('/api/v1/onboarding/draft').send({ step: 'career', values: CAREER }).expect(200);
    const afterPreferences = await agent
      .put('/api/v1/onboarding/draft')
      .send({ step: 'preferences', values: PREFERENCES })
      .expect(200);
    expect(afterPreferences.body.step).toBe('review');
    expect(afterPreferences.body.values.skills).toEqual(['React', 'TypeScript']);

    // Going back to an earlier step doesn't move the resume point backwards.
    const revisited = await agent
      .put('/api/v1/onboarding/draft')
      .send({ step: 'personal', values: PERSONAL })
      .expect(200);
    expect(revisited.body.step).toBe('review');

    const done = await agent.post('/api/v1/onboarding/complete').expect(200);
    expect(done.body).toMatchObject({ completed: true });

    const profile = await agent.get('/api/v1/profile').expect(200);
    expect(profile.body).toMatchObject({
      ...PREFERENCES,
      industryCode: 'software',
      level: 'SENIOR',
      provinceCode: 'ha-noi',
    });
    expect((await agent.get('/api/v1/auth/me')).body.onboardingCompleted).toBe(true);
  });

  it('validates each step with the shared schema and rejects unknown taxonomy codes', async () => {
    const agent = await signUpAndVerify(ctx);

    const invalid = await agent
      .put('/api/v1/onboarding/draft')
      .send({ step: 'career', values: { ...CAREER, yearsOfExperience: 99, skills: [] } })
      .expect(422);
    expect(invalid.body.fieldErrors).toEqual([
      { field: 'values.yearsOfExperience', rule: 'tooLarge', params: { max: 50 } },
      { field: 'values.skills', rule: 'tooFew', params: { min: 1 } },
    ]);

    const unknown = await agent
      .put('/api/v1/onboarding/draft')
      .send({ step: 'personal', values: { ...PERSONAL, provinceCode: 'atlantis' } })
      .expect(422);
    expect(unknown.body.fieldErrors).toEqual([{ field: 'provinceCode', rule: 'invalid' }]);
  });

  it('never requires onboarding from admins', async () => {
    await ctx.prisma.user.create({
      data: {
        email: 'root@offerleap.local',
        passwordHash: await hashPassword('root-password-123'),
        fullName: 'Root',
        role: 'ADMIN',
        adminLevel: 'ROOT',
        emailVerifiedAt: new Date(),
      },
    });
    const admin = request.agent(ctx.app.getHttpServer());
    await admin
      .post('/api/v1/auth/login')
      .send({ email: 'root@offerleap.local', password: 'root-password-123' })
      .expect(200);

    await admin.get('/api/v1/profile').expect(200);
  });
});
