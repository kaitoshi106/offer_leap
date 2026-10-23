import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RESUME_FINAL_STATUSES, type ResumeSummary } from '@offerleap/shared';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

// Hosts without a persistent disk (free tiers) keep uploads in Postgres instead. Set before the app module is
// imported: its configuration is read at import time.
vi.hoisted(() => {
  process.env.STORAGE_DRIVER = 'database';
});

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedTaxonomies(ctx.prisma);
});

afterAll(async () => {
  delete process.env.STORAGE_DRIVER;
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

async function waitForResult(agent: TestAgent, id: string): Promise<ResumeSummary> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await agent.get(`/api/v1/resumes/${id}`).expect(200);
    if (RESUME_FINAL_STATUSES.includes(body.status)) return body;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Resume was not processed in time');
}

describe('uploads kept in the database (STORAGE_DRIVER=database)', () => {
  it('stores a CV in Postgres, reads it back for the AI, and removes it with the CV', async () => {
    const agent = await signUpOnboarded(ctx);
    const cv = readFileSync(join(__dirname, 'fixtures', 'resume.docx'));
    const { body } = await agent.post('/api/v1/resumes').attach('file', cv, 'cv.docx').expect(202);

    const resume = await ctx.prisma.resume.findUniqueOrThrow({ where: { id: body.id } });
    const stored = await ctx.prisma.storedFile.findUniqueOrThrow({ where: { key: resume.storageKey } });
    expect(Buffer.from(stored.data).equals(cv)).toBe(true);

    // The worker reads the file back from the database to send it to the AI.
    expect((await waitForResult(agent, body.id)).status).toBe('COMPLETED');

    await agent.delete(`/api/v1/resumes/${body.id}`).expect(204);
    expect(await ctx.prisma.storedFile.count()).toBe(0);
  });
});
