import type { AdminLevel, Role, UserStatus } from '@offerleap/shared';

/** Translation key of an account's role: root and general admins are told apart. */
export const roleKey = (role: Role, adminLevel: AdminLevel | null) =>
  role === 'ADMIN' && adminLevel ? adminLevel : role;

export const STATUS_TONE: Record<UserStatus, 'success' | 'danger'> = {
  ACTIVE: 'success',
  DISABLED: 'danger',
};
