import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.schema';
import type { PrismaService } from '../prisma/prisma.service';
import { ORPHAN_GRACE_MS, OrphanFilesSweeper } from './orphan-files.sweeper';
import { StorageService } from './storage.service';

const NOW = new Date('2026-10-27T10:00:00.000Z');
const OLD = new Date(NOW.getTime() - ORPHAN_GRACE_MS - 60_000);
const RECENT = new Date(NOW.getTime() - 60_000);

let root: string;
let storage: StorageService;

/** Rows the fake database holds, by table. */
function fakePrisma(resumeKeys: string[], documentKeys: string[]) {
  const model = (keys: string[]) => ({
    findMany: vi.fn(async ({ where }: { where: { storageKey: { in: string[] } } }) =>
      where.storageKey.in.filter((key) => keys.includes(key)).map((storageKey) => ({ storageKey })),
    ),
  });
  return { resume: model(resumeKeys), knowledgeDocument: model(documentKeys) };
}

async function file(key: string, modifiedAt: Date) {
  await storage.put(key, Buffer.from('x'));
  await utimes(join(root, key), modifiedAt, modifiedAt);
}

const sweeper = (prisma: ReturnType<typeof fakePrisma>) =>
  new OrphanFilesSweeper(prisma as unknown as PrismaService, storage);

describe('OrphanFilesSweeper', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'offerleap-storage-'));
    storage = new StorageService({ get: () => root } as unknown as ConfigService<Env, true>);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('removes old CV and document files that no row points at, and keeps the rest', async () => {
    await file('resumes/u1/kept.pdf', OLD);
    await file('resumes/u1/orphan.pdf', OLD);
    await file('resumes/u2/just-uploaded.pdf', RECENT);
    await file('knowledge/u1/kept.txt', OLD);
    await file('knowledge/u1/orphan.md', OLD);

    const removed = await sweeper(fakePrisma(['resumes/u1/kept.pdf'], ['knowledge/u1/kept.txt'])).sweep(NOW);

    expect(removed).toBe(2);
    const left = [...(await storage.list('resumes')), ...(await storage.list('knowledge'))].map(
      ({ key }) => key,
    );
    // A file younger than the grace period may be an upload whose row isn't written yet.
    expect(left.sort()).toEqual([
      'knowledge/u1/kept.txt',
      'resumes/u1/kept.pdf',
      'resumes/u2/just-uploaded.pdf',
    ]);
  });

  it('does nothing when nothing has been stored yet', async () => {
    const prisma = fakePrisma([], []);
    expect(await sweeper(prisma).sweep(NOW)).toBe(0);
    expect(prisma.resume.findMany).not.toHaveBeenCalled();
  });

  it('looks rows up in batches', async () => {
    await Promise.all(Array.from({ length: 501 }, (_, n) => file(`resumes/u1/${n}.pdf`, OLD)));
    const prisma = fakePrisma([], []);
    expect(await sweeper(prisma).sweep(NOW)).toBe(501);
    expect(prisma.resume.findMany).toHaveBeenCalledTimes(2);
  });
});
