import { z } from 'zod';

import { localeSchema } from '../auth/schemas';
import { ValidationRule } from '../validation/rules';
import { JOB_DESCRIPTION_LIMITS } from './constants';

/** `POST /analyses`: compare one of the user's CVs with a job description. */
export const createAnalysisSchema = z.object({
  resumeId: z.string({ error: ValidationRule.REQUIRED }).trim().min(1, { error: ValidationRule.REQUIRED }),
  jobDescription: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(1, { error: ValidationRule.REQUIRED })
    .min(JOB_DESCRIPTION_LIMITS.min, { error: ValidationRule.TOO_SHORT })
    .max(JOB_DESCRIPTION_LIMITS.max, { error: ValidationRule.TOO_LONG }),
  /** Language the AI writes its feedback in (the UI language). */
  locale: localeSchema,
});

export type CreateAnalysisInput = z.input<typeof createAnalysisSchema>;
export type CreateAnalysis = z.output<typeof createAnalysisSchema>;
