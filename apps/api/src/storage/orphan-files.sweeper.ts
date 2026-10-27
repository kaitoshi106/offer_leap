import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Files younger than this are left alone: an upload writes its file just before the row that points at it, so a
 * brand-new file may simply not have its row yet.
 */
export const ORPHAN_GRACE_MS = 60 * 60_000;
const SWEEP_EVERY_MS = 6 * 60 * 60_000;
/** Keys looked up in the database per query. */
const BATCH = 500;

/**
 * @description Deletes stored files no CV or personal document points at any more, so disk use follows what users
 * actually keep. Deleting a CV, a document or an account removes its file too; orphans come from what bypasses
 * that — a process killed between the database and the disk, rows removed by hand or by test clean-ups. Runs at
 * start-up and every few hours (a timer like `StuckJobsSweeper`: no cron dependency, and several API instances
 * sweeping at once only try to remove the same files twice).
 */
@Injectable()
export class OrphanFilesSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrphanFilesSweeper.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    const run = () =>
      this.sweep().catch((error: unknown) =>
        this.logger.warn(`Sweep failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    void run();
    this.timer = setInterval(run, SWEEP_EVERY_MS);
    // Never keeps the process alive on its own.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /**
   * @description Removes CV and document files older than `ORPHAN_GRACE_MS` that no row references.
   * @param now - Current time (a parameter for tests).
   * @returns How many files were removed.
   */
  async sweep(now = new Date()): Promise<number> {
    const cutoff = now.getTime() - ORPHAN_GRACE_MS;
    const files = (await Promise.all([this.storage.list('resumes'), this.storage.list('knowledge')]))
      .flat()
      .filter(({ modifiedAt }) => modifiedAt.getTime() < cutoff)
      .map(({ key }) => key);

    let removed = 0;
    for (let start = 0; start < files.length; start += BATCH) {
      const keys = files.slice(start, start + BATCH);
      const where = { storageKey: { in: keys } };
      const select = { storageKey: true } as const;
      const [resumes, documents] = await Promise.all([
        this.prisma.resume.findMany({ where, select }),
        this.prisma.knowledgeDocument.findMany({ where, select }),
      ]);
      const used = new Set([...resumes, ...documents].map(({ storageKey }) => storageKey));
      const orphans = keys.filter((key) => !used.has(key));
      await Promise.all(orphans.map((key) => this.storage.remove(key)));
      removed += orphans.length;
    }
    if (removed > 0) this.logger.log(`Removed ${removed} orphaned file(s)`);
    return removed;
  }
}
