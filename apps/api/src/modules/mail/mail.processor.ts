import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';

import type { Env } from '../../config/env.schema';
import { renderMail } from './mail.templates';
import { MAIL_QUEUE, type MailJob } from './mail.types';

/** Worker that renders and sends queued emails over SMTP (Mailpit locally). Throwing makes BullMQ retry. */
@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    const user = config.get('SMTP_USER', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      ...(user && { auth: { user, pass: config.get('SMTP_PASSWORD', { infer: true }) } }),
    });
  }

  async process(job: Job<MailJob>): Promise<void> {
    const { subject, text, html } = renderMail(job.data);
    await this.transporter.sendMail({ from: this.from, to: job.data.to, subject, text, html });
    this.logger.log(`Sent ${job.data.template} (job ${job.id})`);
  }
}
