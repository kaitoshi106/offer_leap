import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import type { Job } from 'bullmq';

import { runAiJob } from '../ai/ai-job';
import { ResumesService } from './resumes.service';
import { RESUME_QUEUE, type ResumeJob } from './resumes.types';

/** Parses queued CVs (retry policy in `runAiJob`). */
@Processor(RESUME_QUEUE, { concurrency: 2 })
export class ResumesProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumesProcessor.name);

  constructor(private readonly resumes: ResumesService) {
    super();
  }

  async process(job: Job<ResumeJob>): Promise<void> {
    const { resumeId } = job.data;
    await runAiJob(job, this.logger, () => this.resumes.parse(resumeId), {
      code: ErrorCode.RESUME_PARSE_FAILED,
      markFailed: (code) => this.resumes.markFailed(resumeId, code),
    });
  }
}
