export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const USER_STATUSES = Object.values(UserStatus);

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

/** How long an admin invitation link stays valid. */
export const ADMIN_INVITATION_TTL_HOURS = 48;

export const ADMIN_USERS_PAGE_SIZE = { default: 20, max: 50 } as const;
