import { z } from 'zod';

import { LOCALES } from '../constants/app';
import { ValidationRule } from '../validation/rules';

export const PASSWORD_MIN_LENGTH = 8;
/** Argon2 accepts more, but bcrypt-era clients and password managers commonly cap at 72. */
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .trim()
  .toLowerCase()
  .min(1, { error: ValidationRule.REQUIRED })
  .max(254, { error: ValidationRule.TOO_LONG })
  .pipe(z.email({ error: ValidationRule.INVALID_EMAIL }));

export const passwordSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .min(PASSWORD_MIN_LENGTH, { error: ValidationRule.TOO_SHORT })
  .max(PASSWORD_MAX_LENGTH, { error: ValidationRule.TOO_LONG })
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), { error: ValidationRule.WEAK_PASSWORD });

export const fullNameSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .trim()
  .min(2, { error: ValidationRule.TOO_SHORT })
  .max(100, { error: ValidationRule.TOO_LONG });

const tokenSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .min(16, { error: ValidationRule.INVALID })
  .max(256);

export const localeSchema = z.enum(LOCALES);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  locale: localeSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Only presence is checked on login: rules may have changed since the account was created.
  password: z.string({ error: ValidationRule.REQUIRED }).min(1, { error: ValidationRule.REQUIRED }),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const tokenOnlySchema = z.object({ token: tokenSchema });

export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: ValidationRule.REQUIRED }).min(1, { error: ValidationRule.REQUIRED }),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: ValidationRule.INVALID,
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type TokenOnlyInput = z.infer<typeof tokenOnlySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
