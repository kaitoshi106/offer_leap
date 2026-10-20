import {
  careerStepSchema,
  fullNameSchema,
  phoneSchema,
  PROFILE_LIMITS,
  type ResumeSuggestions,
  skillSchema,
} from '@offerleap/shared';
import type { z } from 'zod';

import type { ResumeExtraction } from '../ai/prompts/resume-extraction.v2';

/**
 * @description Keeps a value only if it passes the same rule the form uses, so a suggestion never puts the
 * form into an invalid state.
 * @param schema - Field schema from @offerleap/shared.
 * @param value - Value read by the AI.
 */
function valid<T>(schema: z.ZodType<T>, value: unknown): T | null {
  if (value === null || value === undefined) return null;
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * @description Turns the AI's raw extraction into form suggestions: values are cleaned and re-validated with
 * the onboarding rules, skills are trimmed/de-duplicated, and invalid values are dropped rather than shown.
 * @param extraction - Schema-checked answer from the model.
 */
export function toResumeSuggestions(extraction: ResumeExtraction): ResumeSuggestions {
  const { shape } = careerStepSchema;
  const skills = extraction.skills
    .map((skill) => valid(skillSchema, skill))
    .filter((skill): skill is string => skill !== null)
    .slice(0, PROFILE_LIMITS.skillsMax);

  const suggestions: Omit<ResumeSuggestions, 'uncertainFields'> = {
    fullName: valid(fullNameSchema, extraction.fullName),
    phone: valid(phoneSchema, extraction.phone),
    provinceCode: extraction.provinceCode,
    industryCode: extraction.industryCode,
    jobTitle: valid(shape.jobTitle, extraction.jobTitle),
    level: extraction.level,
    yearsOfExperience: extraction.yearsOfExperience,
    skills: valid(shape.skills, skills) ?? [],
  };

  // Only flag fields that still hold a value; an empty field needs the user's input anyway.
  const uncertainFields = [...new Set(extraction.uncertainFields)].filter((field) => {
    const value = suggestions[field];
    return Array.isArray(value) ? value.length > 0 : value !== null;
  });
  return { ...suggestions, uncertainFields };
}
