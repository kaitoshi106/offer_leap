import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import type { Job } from 'bullmq';

import { AiUnavailableError } from '../ai/ai.errors';
import { ResumesService } from './resumes.service';
import { RESUME_QUEUE, type ResumeJob } from './resumes.types';

/**
 * Parses queued CVs. A busy AI provider is retried with backoff (BullMQ re-runs the job when `process` throws);
 * anything else — unreadable file, invalid answer — fails at once, since trying again would give the same result.
 */
@Processor(RESUME_QUEUE, { concurrency: 2 })
export class ResumesProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumesProcessor.name);

  constructor(private readonly resumes: ResumesService) {
    super();
  }

  async process(job: Job<ResumeJob>): Promise<void> {
    const { resumeId } = job.data;
    try {
      await this.resumes.parse(resumeId);
      this.logger.log(`Parsed resume ${resumeId}`);
    } catch (error) {
      const retryable = error instanceof AiUnavailableError;
      const attemptsLeft = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
      if (retryable && attemptsLeft) throw error;

      this.logger.warn(
        `Resume ${resumeId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.resumes.markFailed(
        resumeId,
        retryable ? ErrorCode.AI_UNAVAILABLE : ErrorCode.RESUME_PARSE_FAILED,
      );
    }
  }
}
