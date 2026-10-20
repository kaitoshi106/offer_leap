import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { AiQuotaService } from '../ai-quota.service';
import {
  AI_VENDOR,
  type AiJsonRequest,
  type AiJsonResult,
  type AiProvider,
  type AiTextRequest,
  type AiTextStream,
  type AiUsage,
} from '../ai.types';

interface UsageEntry {
  userId: string;
  task: string;
  model: string | null;
  usage: AiUsage;
  startedAt: number;
  error?: unknown;
}

/**
 * Decorator around the vendor provider (same interface, Decorator pattern): checks the user's quota before each
 * call and records every call — tokens, latency, success — for the admin dashboard. Feature modules don't know it
 * exists; they just pass `userId`.
 */
@Injectable()
export class TrackedAiProvider implements AiProvider {
  private readonly logger = new Logger(TrackedAiProvider.name);

  constructor(
    @Inject(AI_VENDOR) private readonly vendor: AiProvider,
    private readonly quota: AiQuotaService,
    private readonly prisma: PrismaService,
  ) {}

  get name(): string {
    return this.vendor.name;
  }

  async generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
    await this.quota.assertAvailable(request.userId);
    const startedAt = Date.now();
    try {
      const result = await this.vendor.generateJson(request);
      await this.record({ ...request, model: result.model, usage: result.usage, startedAt });
      return result;
    } catch (error) {
      await this.record({ ...request, model: null, usage: NO_USAGE, startedAt, error });
      throw error;
    }
  }

  async streamText(request: AiTextRequest): Promise<AiTextStream> {
    await this.quota.assertAvailable(request.userId);
    const startedAt = Date.now();
    let stream: AiTextStream;
    try {
      stream = await this.vendor.streamText(request);
    } catch (error) {
      await this.record({ ...request, model: null, usage: NO_USAGE, startedAt, error });
      throw error;
    }

    // The call only ends when the stream does: record it then (also when the client stops reading early).
    const record = (error?: unknown) =>
      this.record({ ...request, model: stream.model, usage: stream.usage(), startedAt, error });
    async function* chunks(): AsyncGenerator<string> {
      let failure: unknown;
      try {
        yield* stream.chunks;
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        await record(failure);
      }
    }
    return { ...stream, chunks: chunks() };
  }

  /** Writes one log row. A logging failure must never break the user's request, so it is only reported. */
  private async record({ userId, task, model, usage, startedAt, error }: UsageEntry): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          task,
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs: Date.now() - startedAt,
          success: error === undefined,
          errorType: error === undefined ? null : error instanceof Error ? error.name : 'Unknown',
        },
      });
    } catch (logError) {
      this.logger.warn(
        `Could not record AI usage for ${task}: ${logError instanceof Error ? logError.message : logError}`,
      );
    }
  }
}

const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0 };
