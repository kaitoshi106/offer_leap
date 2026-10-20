import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { hashPassword } from '../../src/common/security/hashing';
import { AI_VENDOR, type AiProvider } from '../../src/modules/ai/ai.types';
import { MailService } from '../../src/modules/mail/mail.service';
import type { MailJob } from '../../src/modules/mail/mail.types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { INDUSTRIES } from '../../prisma/seed-data/industries';
import { PROVINCES } from '../../prisma/seed-data/provinces';

/** Captures emails instead of queueing them, so tests can read the links users would receive. */
export class FakeMailService {
  readonly sent: MailJob[] = [];

  async send(job: MailJob): Promise<void> {
    this.sent.push(job);
  }

  /**
   * @description Token from the most recent email of a template sent to an address.
   * @throws Error when no such email was sent.
   */
  lastToken(to: string, template: MailJob['template']): string {
    const job = this.sent.findLast((mail) => mail.to === to && mail.template === template);
    if (!job) throw new Error(`No ${template} email sent to ${to}`);
    const token = new URL(job.link).searchParams.get('token');
    if (!token) throw new Error('Email link has no token');
    return token;
  }
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  mail: FakeMailService;
}

/**
 * @description Boots the real AppModule (real Postgres + Redis) with the fake mailer.
 * @param options.ai - Replaces the AI provider (default: the mock provider from AI_PROVIDER=mock).
 * @returns The initialised app and handles used by assertions.
 */
export async function createTestApp(options: { ai?: AiProvider } = {}): Promise<TestContext> {
  const mail = new FakeMailService();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail);
  if (options.ai) builder = builder.overrideProvider(AI_VENDOR).useValue(options.ai);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService), mail };
}

/**
 * @description Empties every table between tests. TRUNCATE … CASCADE is much faster than deleting rows.
 * @param prisma - Client connected to the test database.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ai_usage_logs", "admin_invitations", "interview_questions", "interview_sessions", "resumes", "job_applications", "job_analyses", "profiles", "refresh_tokens", "user_tokens", "users" CASCADE',
  );
}

/**
 * @description Loads the industry and province taxonomies (idempotent). They are reference data, so
 * `resetDatabase` keeps them.
 * @param prisma - Client connected to the test database.
 */
export async function seedTaxonomies(prisma: PrismaService): Promise<void> {
  await prisma.industry.createMany({
    data: INDUSTRIES.map((industry, sortOrder) => ({ ...industry, sortOrder })),
    skipDuplicates: true,
  });
  await prisma.province.createMany({
    data: PROVINCES.map((province, sortOrder) => ({ ...province, sortOrder })),
    skipDuplicates: true,
  });
}

/**
 * @description Registers and verifies an account through the API and returns a cookie-keeping agent.
 * @param ctx - Test app context.
 * @param email - Account email.
 * @param password - Account password.
 */
export async function signUpAndVerify(ctx: TestContext, email = 'minh@example.com', password = 'leap2026') {
  const agent = request.agent(ctx.app.getHttpServer());
  await agent.post('/api/v1/auth/register').send({ email, password, fullName: 'Trần Minh' }).expect(201);
  await agent
    .post('/api/v1/auth/verify-email')
    .send({ token: ctx.mail.lastToken(email, 'verify-email') })
    .expect(200);
  return agent;
}

/**
 * @description Registers, verifies and completes onboarding through the API, for tests of features that need a
 * finished profile.
 * @param ctx - Test app context (taxonomies must be seeded).
 * @param email - Account email.
 */
export async function signUpOnboarded(ctx: TestContext, email = 'minh@example.com') {
  const agent = await signUpAndVerify(ctx, email);
  const steps = [
    { step: 'personal', values: { fullName: 'Trần Minh', provinceCode: 'ha-noi' } },
    {
      step: 'career',
      values: {
        industryCode: 'software',
        jobTitle: 'Frontend Developer',
        level: 'SENIOR',
        yearsOfExperience: 6,
        skills: ['React'],
      },
    },
    { step: 'preferences', values: { workTypes: ['REMOTE'] } },
  ];
  for (const body of steps) await agent.put('/api/v1/onboarding/draft').send(body).expect(200);
  await agent.post('/api/v1/onboarding/complete').expect(200);
  return agent;
}

/**
 * @description Creates an admin directly in the database (root is normally seeded) and signs in.
 * @param ctx - Test app context.
 * @param level - ROOT or GENERAL.
 * @param email - Account email.
 */
export async function signInAdmin(
  ctx: TestContext,
  level: 'ROOT' | 'GENERAL',
  email = `${level.toLowerCase()}@offerleap.local`,
) {
  const password = 'admin-pass-2026';
  await ctx.prisma.user.create({
    data: {
      email,
      fullName: level === 'ROOT' ? 'Root Admin' : 'General Admin',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      adminLevel: level,
      emailVerifiedAt: new Date(),
    },
  });
  const agent = request.agent(ctx.app.getHttpServer());
  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  return agent;
}
