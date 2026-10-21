import { z } from 'zod';

import { emailSchema, fullNameSchema, localeSchema, passwordSchema } from '../auth/schemas';
import { Role } from '../auth/roles';
import { ValidationRule } from '../validation/rules';
import { pageQuerySchema } from '../pagination';
import { USER_STATUSES } from './constants';

/** `POST /admin/invitations` (root only). `locale` is the language of the email. */
export const inviteAdminSchema = z.object({ email: emailSchema, locale: localeSchema });

/** `POST /auth/accept-invitation`: the invitee sets up their admin account. */
export const acceptInvitationSchema = z.object({
  token: z.string({ error: ValidationRule.REQUIRED }).min(16, { error: ValidationRule.INVALID }).max(256),
  fullName: fullNameSchema,
  password: passwordSchema,
});

/** Query string of `GET /admin/users` (strings in the URL, coerced). */
export const adminUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum([Role.USER, Role.ADMIN]).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

/** `PATCH /admin/users/:id/status`. */
export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES, { error: ValidationRule.INVALID }),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type AdminUsersQueryInput = z.input<typeof adminUsersQuerySchema>;
export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
