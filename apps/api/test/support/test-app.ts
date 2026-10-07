import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { MailService } from '../../src/modules/mail/mail.service';
import type { MailJob } from '../../src/modules/mail/mail.types';
import { PrismaService } from '../../src/prisma/prisma.service';

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
 * @returns The initialised app and handles used by assertions.
 */
export async function createTestApp(): Promise<TestContext> {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

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
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "refresh_tokens", "user_tokens", "users" CASCADE');
}
