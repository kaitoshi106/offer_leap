import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { MAIL_QUEUE, type MailJob } from './mail.types';

/**
 * Enqueues emails instead of sending them inside the request: the HTTP response doesn't wait for SMTP, and
 * failed sends are retried by the queue.
 */
@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>) {}

  async send(job: MailJob): Promise<void> {
    await this.queue.add(job.template, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
