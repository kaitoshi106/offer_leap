import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AI_PROVIDER, type AiProvider } from '../../src/modules/ai/ai.types';
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
  if (options.ai) builder = builder.overrideProvider(AI_PROVIDER).useValue(options.ai);
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
    'TRUNCATE TABLE "resumes", "profiles", "refresh_tokens", "user_tokens", "users" CASCADE',
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
