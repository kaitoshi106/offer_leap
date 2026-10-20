import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import type { Job } from 'bullmq';

import { runAiJob } from '../ai/ai-job';
import { AnalysesService } from './analyses.service';
import { ANALYSIS_QUEUE, type AnalysisJob } from './analyses.types';

/** Runs queued CV ↔ job analyses (retry policy in `runAiJob`). */
@Processor(ANALYSIS_QUEUE, { concurrency: 2 })
export class AnalysesProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysesProcessor.name);

  constructor(private readonly analyses: AnalysesService) {
    super();
  }

  async process(job: Job<AnalysisJob>): Promise<void> {
    const { analysisId } = job.data;
    await runAiJob(job, this.logger, () => this.analyses.analyse(analysisId), {
      code: ErrorCode.ANALYSIS_FAILED,
      markFailed: (code) => this.analyses.markFailed(analysisId, code),
    });
  }
}
