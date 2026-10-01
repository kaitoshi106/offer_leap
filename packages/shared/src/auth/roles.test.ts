import { describe, expect, it } from 'vitest';

import { AdminLevel, canInviteAdmins, canManageOwnPassword, isRootAdmin, Role } from './roles';

const user = { role: Role.USER, adminLevel: null };
const root = { role: Role.ADMIN, adminLevel: AdminLevel.ROOT };
const general = { role: Role.ADMIN, adminLevel: AdminLevel.GENERAL };

describe('admin capabilities', () => {
  it('identifies only the root admin as root', () => {
    expect(isRootAdmin(root)).toBe(true);
    expect(isRootAdmin(general)).toBe(false);
    expect(isRootAdmin(user)).toBe(false);
  });

  it('blocks password management for the root admin only', () => {
    expect(canManageOwnPassword(root)).toBe(false);
    expect(canManageOwnPassword(general)).toBe(true);
    expect(canManageOwnPassword(user)).toBe(true);
  });

  it('lets only the root admin invite other admins', () => {
    expect(canInviteAdmins(root)).toBe(true);
    expect(canInviteAdmins(general)).toBe(false);
    expect(canInviteAdmins(user)).toBe(false);
  });
});
