import { describe, expect, it } from 'vitest';

import { canManageAccount } from '../auth/roles';
import { acceptInvitationSchema, adminUsersQuerySchema } from './index';

const root = { id: 'root', role: 'ADMIN', adminLevel: 'ROOT' } as const;
const general = { id: 'g1', role: 'ADMIN', adminLevel: 'GENERAL' } as const;
const otherGeneral = { id: 'g2', role: 'ADMIN', adminLevel: 'GENERAL' } as const;
const user = { id: 'u1', role: 'USER', adminLevel: null } as const;

describe('canManageAccount', () => {
  it.each([
    ['root → user', root, user, true],
    ['root → general admin', root, general, true],
    ['general → user', general, user, true],
    ['general → another general admin', general, otherGeneral, false],
    ['general → root', general, root, false],
    ['root → itself', root, root, false],
    ['user → user', user, { ...user, id: 'u2' }, false],
  ])('%s: %s', (_case, actor, target, expected) => {
    expect(canManageAccount(actor, target)).toBe(expected);
  });
});

describe('adminUsersQuerySchema', () => {
  it('coerces query-string numbers and applies defaults', () => {
    expect(adminUsersQuerySchema.parse({ page: '2', q: ' minh ' })).toEqual({
      page: 2,
      pageSize: 20,
      q: 'minh',
    });
    expect(adminUsersQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('needs a token, a name and a strong enough password', () => {
    expect(
      acceptInvitationSchema.safeParse({ token: 'x'.repeat(43), fullName: 'Lan', password: 'leap2026' })
        .success,
    ).toBe(true);
    expect(
      acceptInvitationSchema.safeParse({ token: 'x'.repeat(43), fullName: 'Lan', password: 'short' }).success,
    ).toBe(false);
  });
});
