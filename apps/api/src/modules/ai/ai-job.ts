import type { Logger } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import type { Job } from 'bullmq';

import { AiQuotaExceededError, AiUnavailableError } from './ai.errors';

/**
 * @description Runs the work of a queued AI job with one failure policy for every AI feature: a busy provider is
 * retried with backoff (rethrowing makes BullMQ re-run the job) while attempts remain; anything else — unreadable
 * input, unusable answer — or the last attempt marks the record failed, since trying again would give the same
 * result. A used-up quota fails with `AI_QUOTA_EXCEEDED` (retrying before the window moves is pointless).
 * @param job - BullMQ job (for its attempt counters).
 * @param logger - Processor logger.
 * @param work - The job's work.
 * @param failure.code - Code stored when the work fails for good (other than an unavailable provider).
 * @param failure.markFailed - Stores the error code on the record so the client can show it.
 * @throws AiUnavailableError while retries remain.
 */
export async function runAiJob(
  job: Job,
  logger: Logger,
  work: () => Promise<void>,
  failure: { code: ErrorCode; markFailed: (code: ErrorCode) => Promise<void> },
): Promise<void> {
  try {
    await work();
  } catch (error) {
    const retryable = error instanceof AiUnavailableError;
    const attemptsLeft = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    if (retryable && attemptsLeft) throw error;

    logger.warn(
      `Job ${job.name} ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (error instanceof AiQuotaExceededError) await failure.markFailed(ErrorCode.AI_QUOTA_EXCEEDED);
    else await failure.markFailed(retryable ? ErrorCode.AI_UNAVAILABLE : failure.code);
  }
}

/** Queue options shared by AI jobs: 3 attempts, 5 s → 10 s backoff, bounded history in Redis. */
export const AI_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 1_000,
} as const;
