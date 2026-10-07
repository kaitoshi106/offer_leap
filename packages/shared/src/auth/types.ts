import { z } from 'zod';

import { LOCALES } from '../constants/app';
import { AdminLevel, Role } from './roles';

/** The signed-in account as returned by the API (`/auth/me`, login, refresh). Never contains secrets. */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  fullName: z.string(),
  role: z.enum([Role.USER, Role.ADMIN]),
  adminLevel: z.enum([AdminLevel.ROOT, AdminLevel.GENERAL]).nullable(),
  locale: z.enum(LOCALES),
  emailVerified: z.boolean(),
  onboardingCompleted: z.boolean(),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  /** ISO timestamp; the client refreshes shortly before it. Tokens themselves live in httpOnly cookies. */
  accessTokenExpiresAt: z.iso.datetime(),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
