import { z } from 'zod';

import { ValidationRule } from '../validation/rules';

/** `DELETE /account`: the current password confirms that the owner, not someone at an unlocked screen, asks. */
export const deleteAccountSchema = z.object({
  password: z.string({ error: ValidationRule.REQUIRED }).min(1, { error: ValidationRule.REQUIRED }).max(128),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
