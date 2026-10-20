import { z } from 'zod';

import { JOB_DESCRIPTION_LIMITS } from '../analysis/constants';
import { localeSchema } from '../auth/schemas';
import { ValidationRule } from '../validation/rules';
import { INTERVIEW_LIMITS, INTERVIEW_TYPES } from './constants';

/** `POST /interviews`: start a mock interview, for a tracked application or any job title. */
export const createInterviewSchema = z.object({
  applicationId: z.string().trim().min(1).optional(),
  jobTitle: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(2, { error: ValidationRule.TOO_SHORT })
    .max(INTERVIEW_LIMITS.jobTitle, { error: ValidationRule.TOO_LONG }),
  jobDescription: z
    .string()
    .trim()
    .max(JOB_DESCRIPTION_LIMITS.max, { error: ValidationRule.TOO_LONG })
    .transform((value) => value || null)
    .nullish(),
  type: z.enum(INTERVIEW_TYPES, { error: ValidationRule.REQUIRED }),
  questionCount: z
    .number({ error: ValidationRule.REQUIRED })
    .int({ error: ValidationRule.INVALID })
    .min(INTERVIEW_LIMITS.questionsMin, { error: ValidationRule.TOO_SMALL })
    .max(INTERVIEW_LIMITS.questionsMax, { error: ValidationRule.TOO_LARGE }),
  locale: localeSchema,
});

/** `POST /interviews/:id/questions/:index/answer`. */
export const answerQuestionSchema = z.object({
  answer: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(1, { error: ValidationRule.REQUIRED })
    .max(INTERVIEW_LIMITS.answerMax, { error: ValidationRule.TOO_LONG }),
});

export type CreateInterviewInput = z.input<typeof createInterviewSchema>;
export type CreateInterview = z.output<typeof createInterviewSchema>;
export type AnswerQuestion = z.output<typeof answerQuestionSchema>;
