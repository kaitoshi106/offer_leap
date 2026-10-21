import { describe, expect, it } from 'vitest';

import { canDeleteOwnAccount, canUseSignInProviders } from '../auth/roles';
import { deleteAccountSchema } from './schemas';

describe('deleteAccountSchema', () => {
  it('needs the current password', () => {
    expect(deleteAccountSchema.safeParse({ password: 'leap2026' }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ password: '' }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });
});

describe('canDeleteOwnAccount', () => {
  it.each([
    ['user', { role: 'USER', adminLevel: null }, true],
    ['general admin', { role: 'ADMIN', adminLevel: 'GENERAL' }, true],
    ['root', { role: 'ADMIN', adminLevel: 'ROOT' }, false],
  ] as const)('%s', (_case, account, expected) => {
    expect(canDeleteOwnAccount(account)).toBe(expected);
  });
});

describe('canUseSignInProviders', () => {
  it('lets users, not admins, sign in with Google', () => {
    expect(canUseSignInProviders({ role: 'USER', adminLevel: null })).toBe(true);
    expect(canUseSignInProviders({ role: 'ADMIN', adminLevel: 'GENERAL' })).toBe(false);
    expect(canUseSignInProviders({ role: 'ADMIN', adminLevel: 'ROOT' })).toBe(false);
  });
});
