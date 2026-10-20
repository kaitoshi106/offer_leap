import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_QUOTA_WINDOW_HOURS, type AiQuotaStatus } from '@offerleap/shared';

import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { AiQuotaExceededError } from './ai.errors';

const WINDOW_MS = AI_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Per-user AI quota: successful calls in a rolling 24-hour window, against `AI_DAILY_QUOTA` or the user's own
 * override. Failed calls don't count. Admins have no limit.
 */
@Injectable()
export class AiQuotaService {
  private readonly defaultQuota: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.defaultQuota = config.get('AI_DAILY_QUOTA', { infer: true });
  }

  get default(): number {
    return this.defaultQuota;
  }

  /** Calls used in the current window and the limit that applies. */
  async status(userId: string): Promise<AiQuotaStatus> {
    const [user, used] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, aiDailyQuota: true } }),
      this.prisma.aiUsageLog.count({
        // Embedding calls (`embed-*`) are logged but free: they run on every search.
        where: {
          userId,
          success: true,
          createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
          NOT: { task: { startsWith: 'embed' } },
        },
      }),
    ]);
    const limit = user?.role === 'ADMIN' ? null : (user?.aiDailyQuota ?? this.defaultQuota);
    return { used, limit, windowHours: AI_QUOTA_WINDOW_HOURS };
  }

  /**
   * @description Refuses a call when the user has no calls left. Two calls racing at the very limit can both
   * pass — acceptable for a cost guard (one extra call), and it keeps the hot path a single count query.
   * @throws AiQuotaExceededError
   */
  async assertAvailable(userId: string): Promise<void> {
    const { used, limit } = await this.status(userId);
    if (limit !== null && used >= limit) {
      throw new AiQuotaExceededError(`AI quota used up (${used}/${limit} in ${AI_QUOTA_WINDOW_HOURS} h)`);
    }
  }
}
