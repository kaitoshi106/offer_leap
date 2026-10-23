import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * A record still waiting after this long has lost its job: the slowest job (3 attempts, 5 s → 10 s backoff, each
 * call bounded by the provider's timeout) is done within a few minutes.
 */
export const STUCK_AFTER_MS = 15 * 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * @description Fails background AI records whose job will never finish, so clients stop polling them: the worker
 * died mid-job and BullMQ gave up on it (that failure never reaches `process`), or the job was lost in Redis. The
 * user then sees the usual "failed, try again" state instead of a spinner forever. Runs at start-up and every few
 * minutes.
 */
@Injectable()
export class StuckJobsSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StuckJobsSweeper.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

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
   * @description Marks every record stuck since before `now - STUCK_AFTER_MS` as failed.
   * @param now - Current time (a parameter for tests).
   * @returns How many records were failed.
   */
  async sweep(now = new Date()): Promise<number> {
    const where = {
      status: { in: ['PENDING' as const, 'PROCESSING' as const] },
      updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) },
    };
    const failed = (errorCode: ErrorCode) => ({ status: 'FAILED' as const, errorCode, processedAt: now });
    const results = await Promise.all([
      this.prisma.resume.updateMany({ where, data: failed(ErrorCode.RESUME_PARSE_FAILED) }),
      this.prisma.jobAnalysis.updateMany({ where, data: failed(ErrorCode.ANALYSIS_FAILED) }),
      this.prisma.knowledgeDocument.updateMany({
        where,
        data: failed(ErrorCode.KNOWLEDGE_PROCESSING_FAILED),
      }),
    ]);
    const count = results.reduce((total, result) => total + result.count, 0);
    if (count > 0) this.logger.warn(`Marked ${count} stuck background record(s) as failed`);
    return count;
  }
}
