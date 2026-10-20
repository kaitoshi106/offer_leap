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
      pageSize: 10,
      q: 'minh',
    });
    expect(adminUsersQuerySchema.parse({ pageSize: '50' }).pageSize).toBe(50);
    expect(adminUsersQuerySchema.safeParse({ pageSize: '20' }).success).toBe(false);
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

describe('createIndustrySchema', () => {
  it('accepts a lowercase slug code', async () => {
    const { createIndustrySchema } = await import('./industries');
    expect(
      createIndustrySchema.parse({
        code: ' Game-Dev ',
        nameVi: 'Phát triển game',
        nameEn: 'Game development',
      }).code,
    ).toBe('game-dev');
    for (const code of ['game dev', 'game--dev', '-game', 'game_dev']) {
      expect(createIndustrySchema.safeParse({ code, nameVi: 'x', nameEn: 'x' }).success).toBe(false);
    }
  });
});

describe('updateAiQuotaSchema', () => {
  it('takes a whole number within range, or null for the default', async () => {
    const { updateAiQuotaSchema } = await import('./usage');
    expect(updateAiQuotaSchema.parse({ aiDailyQuota: null })).toEqual({ aiDailyQuota: null });
    expect(updateAiQuotaSchema.parse({ aiDailyQuota: 0 })).toEqual({ aiDailyQuota: 0 });
    expect(updateAiQuotaSchema.safeParse({ aiDailyQuota: 1.5 }).success).toBe(false);
    expect(updateAiQuotaSchema.safeParse({ aiDailyQuota: 5000 }).success).toBe(false);
  });
});
