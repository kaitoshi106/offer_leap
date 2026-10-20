import { Injectable } from '@nestjs/common';
import type { AiUsageStats, AiUsageTotals } from '@offerleap/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AiQuotaService } from '../ai/ai-quota.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days on the chart are Vietnam days, whatever the server's time zone. */
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const TOP_USERS = 5;

/** `YYYY-MM-DD` of a date in Vietnam time. */
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);

/** Aggregates of `ai_usage_logs` for the admin dashboard. */
@Injectable()
export class AdminUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: AiQuotaService,
  ) {}

  /**
   * @description Calls, failures, tokens and latency over the last `days` days: in total, per prompt, per day and
   * for the heaviest users. Grouping happens in the database (one query per view), not in memory.
   * @param days - Length of the period.
   */
  async stats(days: number): Promise<AiUsageStats> {
    const since = new Date(Date.now() - days * DAY_MS);
    const where = { createdAt: { gte: since } };
    const aggregate = {
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
      _avg: { latencyMs: true },
    } as const;

    const [all, failed, tasks, failedTasks, perDay, users] = await Promise.all([
      this.prisma.aiUsageLog.aggregate({ where, ...aggregate }),
      this.prisma.aiUsageLog.count({ where: { ...where, success: false } }),
      this.prisma.aiUsageLog.groupBy({ by: ['task'], where, ...aggregate, orderBy: { task: 'asc' } }),
      this.prisma.aiUsageLog.groupBy({
        by: ['task'],
        where: { ...where, success: false },
        _count: { _all: true },
      }),
      // date_trunc per local day needs SQL; parameters are bound by Prisma, not concatenated.
      this.prisma.$queryRaw<{ date: string; calls: number; failures: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS date,
               count(*)::int AS calls,
               (count(*) FILTER (WHERE NOT success))::int AS failures
        FROM ai_usage_logs
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1`,
      this.prisma.aiUsageLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
        orderBy: { _count: { userId: 'desc' } },
        take: TOP_USERS,
      }),
    ]);

    const failuresByTask = new Map(failedTasks.map((row) => [row.task, row._count._all]));
    const totals = (row: typeof all, failures: number): AiUsageTotals => ({
      calls: row._count._all,
      failures,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      avgLatencyMs: Math.round(row._avg.latencyMs ?? 0),
    });

    const people = await this.prisma.user.findMany({
      where: { id: { in: users.map((row) => row.userId!) } },
      select: { id: true, email: true, fullName: true },
    });
    const byId = new Map(people.map((person) => [person.id, person]));

    return {
      days,
      totals: totals(all, failed),
      byTask: tasks.map((row) => ({ task: row.task, ...totals(row, failuresByTask.get(row.task) ?? 0) })),
      byDay: this.fillDays(days, perDay),
      topUsers: users.flatMap((row) => {
        const person = byId.get(row.userId!);
        return person
          ? [
              {
                userId: person.id,
                email: person.email,
                fullName: person.fullName,
                calls: row._count._all,
                tokens: (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0),
              },
            ]
          : [];
      }),
      defaultQuota: this.quota.default,
    };
  }

  /** Every day of the period, so the chart has no gaps on quiet days. */
  private fillDays(days: number, rows: { date: string; calls: number; failures: number }[]) {
    const found = new Map(rows.map((row) => [row.date, row]));
    return Array.from({ length: days }, (_, index) => {
      const date = dayKey(new Date(Date.now() - (days - 1 - index) * DAY_MS));
      return found.get(date) ?? { date, calls: 0, failures: 0 };
    });
  }
}
