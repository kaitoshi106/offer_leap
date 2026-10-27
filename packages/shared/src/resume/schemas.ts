import { z } from 'zod';

import { ValidationRule } from '../validation/rules';

/**
 * Text fields sent with the file in `POST /resumes`. `replaceId`: one of the user's CVs to delete in the same step,
 * to make room when they already have `RESUME_MAX_PER_USER`.
 */
export const uploadResumeFieldsSchema = z
  .object({
    replaceId: z.string().trim().min(1).max(64, { error: ValidationRule.TOO_LONG }).optional(),
  })
  // No text fields at all: a request without a file has no parsed body; the missing file is reported instead.
  .default({});
export type UploadResumeFields = z.infer<typeof uploadResumeFieldsSchema>;
