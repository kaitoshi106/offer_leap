import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import type { Job } from 'bullmq';

import { runAiJob } from '../ai/ai-job';
import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_QUEUE, type KnowledgeJob } from './knowledge.types';

/** Extracts, chunks and embeds queued documents (retry policy in `runAiJob`). */
@Processor(KNOWLEDGE_QUEUE, { concurrency: 2 })
export class KnowledgeProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeProcessor.name);

  constructor(private readonly knowledge: KnowledgeService) {
    super();
  }

  async process(job: Job<KnowledgeJob>): Promise<void> {
    const { documentId } = job.data;
    await runAiJob(job, this.logger, () => this.knowledge.process(documentId), {
      code: ErrorCode.KNOWLEDGE_PROCESSING_FAILED,
      markFailed: (code) => this.knowledge.markFailed(documentId, code),
    });
  }
}
