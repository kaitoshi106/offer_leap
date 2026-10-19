import { z } from 'zod';

import { fullNameSchema } from '../auth/schemas';
import { ValidationRule } from '../validation/rules';
import { CAREER_LEVELS, PROFILE_LIMITS, WORK_TYPES } from './constants';

const required = { error: ValidationRule.REQUIRED };

/**
 * Vietnamese mobile numbers, stored as 10 digits starting with 0. Spaces, dots, dashes, brackets and `+` are
 * dropped and the country code becomes 0: "+84 912 345 678" / "(84) 912.345.678" → "0912345678".
 */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s.()+-]/g, '').replace(/^84(?=\d{9}$)/, '0'))
  .pipe(z.string().regex(/^0\d{9}$/, { error: ValidationRule.INVALID_PHONE }));

const codeSchema = z.string(required).trim().min(1, required).max(50);

export const skillSchema = z
  .string()
  .trim()
  .min(1, required)
  .max(PROFILE_LIMITS.skillLength, { error: ValidationRule.TOO_LONG });

/** Step 1 — who and where. */
export const personalStepSchema = z.object({
  fullName: fullNameSchema,
  // Empty input means "no phone".
  phone: z.union([z.literal(''), phoneSchema]).optional(),
  provinceCode: codeSchema,
});

/** Step 2 — career. */
export const careerStepSchema = z.object({
  industryCode: codeSchema,
  jobTitle: z
    .string(required)
    .trim()
    .min(2, { error: ValidationRule.TOO_SHORT })
    .max(100, { error: ValidationRule.TOO_LONG }),
  level: z.enum(CAREER_LEVELS, required),
  yearsOfExperience: z
    .number(required)
    .int({ error: ValidationRule.INVALID })
    .min(0, { error: ValidationRule.TOO_SMALL })
    .max(PROFILE_LIMITS.yearsMax, { error: ValidationRule.TOO_LARGE }),
  skills: z
    .array(skillSchema)
    .min(1, { error: ValidationRule.TOO_FEW })
    .max(PROFILE_LIMITS.skillsMax, { error: ValidationRule.TOO_MANY })
    // Case-insensitive de-duplication keeps the first spelling.
    .transform((skills) =>
      skills.filter(
        (skill, index) => skills.findIndex((other) => other.toLowerCase() === skill.toLowerCase()) === index,
      ),
    ),
});

const salarySchema = z
  .number()
  .int({ error: ValidationRule.INVALID })
  .min(0, { error: ValidationRule.TOO_SMALL })
  .max(PROFILE_LIMITS.salaryMax, { error: ValidationRule.TOO_LARGE });

/** Step 3 — what the user is looking for. Salary is optional, in million VND per month. */
export const preferencesStepSchema = z
  .object({
    expectedSalaryMin: salarySchema.nullable().optional(),
    expectedSalaryMax: salarySchema.nullable().optional(),
    workTypes: z.array(z.enum(WORK_TYPES)).min(1, { error: ValidationRule.TOO_FEW }),
  })
  .refine(({ expectedSalaryMin: min, expectedSalaryMax: max }) => min == null || max == null || min <= max, {
    error: ValidationRule.MIN_EXCEEDS_MAX,
    path: ['expectedSalaryMax'],
  });

/** Everything required to finish onboarding. */
export const completeOnboardingSchema = personalStepSchema
  .extend(careerStepSchema.shape)
  .extend(preferencesStepSchema.shape)
  .refine(({ expectedSalaryMin: min, expectedSalaryMax: max }) => min == null || max == null || min <= max, {
    error: ValidationRule.MIN_EXCEEDS_MAX,
    path: ['expectedSalaryMax'],
  });

/**
 * Saving a wizard step: `step` picks the schema for `values`, so each step validates only its own fields and the
 * rest of the draft stays as it was. The review step has nothing to save.
 */
export const saveOnboardingStepSchema = z.discriminatedUnion('step', [
  // Uploading a CV is optional; saving this step just moves the resume point forward.
  z.object({ step: z.literal('resume'), values: z.object({}).strict() }),
  z.object({ step: z.literal('personal'), values: personalStepSchema }),
  z.object({ step: z.literal('career'), values: careerStepSchema }),
  z.object({ step: z.literal('preferences'), values: preferencesStepSchema }),
]);

export type PersonalStepInput = z.input<typeof personalStepSchema>;
export type PersonalStep = z.output<typeof personalStepSchema>;
export type CareerStepInput = z.input<typeof careerStepSchema>;
export type CareerStep = z.output<typeof careerStepSchema>;
export type PreferencesStepInput = z.input<typeof preferencesStepSchema>;
export type PreferencesStep = z.output<typeof preferencesStepSchema>;
export type CompleteOnboardingInput = z.output<typeof completeOnboardingSchema>;
export type SaveOnboardingStepInput = z.input<typeof saveOnboardingStepSchema>;
export type SaveOnboardingStep = z.output<typeof saveOnboardingStepSchema>;
