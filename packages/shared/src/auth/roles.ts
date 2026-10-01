export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * ROOT is provisioned by the system (seed) and is the only admin allowed to invite others.
 * GENERAL admins join through an email invitation sent by ROOT.
 */
export const AdminLevel = {
  ROOT: 'ROOT',
  GENERAL: 'GENERAL',
} as const;
export type AdminLevel = (typeof AdminLevel)[keyof typeof AdminLevel];

export interface AccountIdentity {
  role: Role;
  adminLevel: AdminLevel | null;
}

/**
 * @description Whether the account is the system-provisioned root admin.
 * @param account - Role and admin level of the account.
 * @returns `true` only for an ADMIN whose level is ROOT.
 */
export function isRootAdmin(account: AccountIdentity): boolean {
  return account.role === Role.ADMIN && account.adminLevel === AdminLevel.ROOT;
}

/**
 * @description Whether the account may change or reset its own password from the app.
 * The root admin's credentials are managed through environment config only.
 * @param account - Role and admin level of the account.
 * @returns `false` for the root admin, `true` for everyone else.
 */
export function canManageOwnPassword(account: AccountIdentity): boolean {
  return !isRootAdmin(account);
}

/**
 * @description Whether the account may invite or revoke general admins.
 * @param account - Role and admin level of the account.
 * @returns `true` only for the root admin.
 */
export function canInviteAdmins(account: AccountIdentity): boolean {
  return isRootAdmin(account);
}
