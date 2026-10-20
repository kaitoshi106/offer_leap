import { z } from 'zod';

import { ValidationRule } from '../validation/rules';

/** Window of the per-user AI quota: a rolling 24 hours (no time-zone questions). */
export const AI_QUOTA_WINDOW_HOURS = 24;
export const AI_QUOTA_MAX = 1_000;

/** Periods offered on the usage dashboard. */
export const AI_USAGE_PERIODS = [7, 30, 90] as const;

/** `GET /admin/ai-usage?days=`. */
export const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

/** `PATCH /admin/users/:id/ai-quota`: `null` goes back to the default limit. */
export const updateAiQuotaSchema = z.object({
  aiDailyQuota: z
    .number({ error: ValidationRule.INVALID })
    .int({ error: ValidationRule.INVALID })
    .min(0, { error: ValidationRule.TOO_SMALL })
    .max(AI_QUOTA_MAX, { error: ValidationRule.TOO_LARGE })
    .nullable(),
});

export type AiUsageQueryInput = z.input<typeof aiUsageQuerySchema>;
export type AiUsageQuery = z.output<typeof aiUsageQuerySchema>;
export type UpdateAiQuotaInput = z.infer<typeof updateAiQuotaSchema>;

export interface AiUsageTotals {
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
}

/** `GET /admin/ai-usage`. */
export interface AiUsageStats {
  days: number;
  totals: AiUsageTotals;
  /** One row per prompt (`resume-extraction.v2`, `job-match.v1`…). */
  byTask: (AiUsageTotals & { task: string })[];
  /** Every day of the period (zeros included), oldest first, `YYYY-MM-DD` in Vietnam time. */
  byDay: { date: string; calls: number; failures: number }[];
  topUsers: { userId: string; email: string; fullName: string; calls: number; tokens: number }[];
  defaultQuota: number;
}

/** `GET /ai/quota`: the signed-in user's AI calls in the current window. `limit` is null for admins (no limit). */
export interface AiQuotaStatus {
  used: number;
  limit: number | null;
  windowHours: number;
}
