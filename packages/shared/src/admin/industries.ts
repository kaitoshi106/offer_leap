import { z } from 'zod';

import { ValidationRule } from '../validation/rules';

const nameSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .trim()
  .min(1, { error: ValidationRule.REQUIRED })
  .max(100, { error: ValidationRule.TOO_LONG });

/** `POST /admin/industries`. The code is permanent (profiles and prompts refer to it), so it is a slug. */
export const createIndustrySchema = z.object({
  code: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: ValidationRule.INVALID })
    .max(50, { error: ValidationRule.TOO_LONG }),
  nameVi: nameSchema,
  nameEn: nameSchema,
});

/** `PATCH /admin/industries/:code`: names only. */
export const updateIndustrySchema = createIndustrySchema.pick({ nameVi: true, nameEn: true });

export type CreateIndustryInput = z.infer<typeof createIndustrySchema>;
export type UpdateIndustryInput = z.infer<typeof updateIndustrySchema>;

export interface AdminIndustry {
  code: string;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  /** Profiles using it; an industry in use can't be deleted. */
  profileCount: number;
}
