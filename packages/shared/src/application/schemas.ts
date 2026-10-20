import { z } from 'zod';

import { JOB_DESCRIPTION_LIMITS } from '../analysis/constants';
import { localeSchema } from '../auth/schemas';
import { ValidationRule } from '../validation/rules';
import { APPLICATION_LIMITS, APPLICATION_STATUSES } from './constants';

const requiredText = (max: number) =>
  z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(1, { error: ValidationRule.REQUIRED })
    .max(max, { error: ValidationRule.TOO_LONG });

/** Optional text: empty input is stored as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: ValidationRule.TOO_LONG })
    .transform((value) => value || null)
    .nullish();

const jobUrlSchema = z
  .union([
    z.literal(''),
    z.url({ protocol: /^https?$/, error: ValidationRule.INVALID }).max(APPLICATION_LIMITS.jobUrl),
  ])
  .transform((value) => value || null)
  .nullish();

/** `POST /applications`. */
export const createApplicationSchema = z.object({
  company: requiredText(APPLICATION_LIMITS.company),
  jobTitle: requiredText(APPLICATION_LIMITS.jobTitle),
  jobUrl: jobUrlSchema,
  jobDescription: optionalText(JOB_DESCRIPTION_LIMITS.max),
  status: z.enum(APPLICATION_STATUSES).default('SAVED'),
  /** Create from an analysis: links it and copies its job description. */
  analysisId: z.string().trim().min(1).optional(),
});

/** `PATCH /applications/:id`: any subset of the editable fields. */
export const updateApplicationSchema = z
  .object({
    company: requiredText(APPLICATION_LIMITS.company),
    jobTitle: requiredText(APPLICATION_LIMITS.jobTitle),
    jobUrl: jobUrlSchema,
    jobDescription: optionalText(JOB_DESCRIPTION_LIMITS.max),
    notes: optionalText(APPLICATION_LIMITS.notes),
    coverLetter: optionalText(APPLICATION_LIMITS.coverLetter),
  })
  .partial();

/**
 * `PATCH /applications/:id/move`: new column and position. Positions are fractional so a card can be dropped
 * between two others by taking the midpoint, without renumbering the column.
 */
export const moveApplicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, { error: ValidationRule.INVALID }),
  position: z.number({ error: ValidationRule.INVALID }).finite({ error: ValidationRule.INVALID }),
});

/** `POST /applications/:id/cover-letter`. */
export const generateCoverLetterSchema = z.object({ locale: localeSchema });

export type CreateApplicationInput = z.input<typeof createApplicationSchema>;
export type CreateApplication = z.output<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;
export type UpdateApplication = z.output<typeof updateApplicationSchema>;
export type MoveApplication = z.output<typeof moveApplicationSchema>;
export type GenerateCoverLetter = z.output<typeof generateCoverLetterSchema>;
