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
 * @description Whether the account may delete itself from the app. Root is provisioned by config and must always
 * exist, so it can't.
 * @param account - Role and admin level of the account.
 */
export function canDeleteOwnAccount(account: AccountIdentity): boolean {
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

/**
 * @description Whether an admin may change another account (disable it, enable it). Nobody changes their own
 * account this way and nobody touches root; general admins manage users, root also manages general admins.
 * @param actor - The admin acting (with id).
 * @param target - The account being changed (with id).
 */
export function canManageAccount(
  actor: AccountIdentity & { id: string },
  target: AccountIdentity & { id: string },
): boolean {
  if (actor.role !== Role.ADMIN || actor.id === target.id || isRootAdmin(target)) return false;
  return target.role === Role.USER || isRootAdmin(actor);
}
