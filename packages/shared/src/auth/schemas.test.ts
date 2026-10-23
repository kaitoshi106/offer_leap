import { describe, expect, it } from 'vitest';

import { changePasswordSchema, loginSchema, passwordSchema, registerSchema } from './schemas';

/**
 * @description Returns the rule names Zod reported per field, e.g. `{ password: ['tooShort'] }`.
 */
function rulesOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const rules: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? []) {
    const field = issue.path.join('.');
    (rules[field] ??= []).push(issue.message);
  }
  return rules;
}

describe('registerSchema', () => {
  it('normalises the email and accepts a valid payload', () => {
    const result = registerSchema.safeParse({
      email: '  Minh@Example.COM ',
      password: 'leap2026',
      fullName: ' Trần Minh ',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'minh@example.com', password: 'leap2026', fullName: 'Trần Minh' });
  });

  it('reports rule names the web app can translate', () => {
    const result = registerSchema.safeParse({ email: 'nope', password: 'short', fullName: 'A' });

    expect(rulesOf(result)).toEqual({
      email: ['invalidEmail'],
      password: ['tooShort', 'weakPassword'],
      fullName: ['tooShort'],
    });
  });

  it('reports missing fields as required', () => {
    expect(rulesOf(registerSchema.safeParse({}))).toEqual({
      email: ['required'],
      password: ['required'],
      fullName: ['required'],
    });
  });
});

describe('passwordSchema', () => {
  it.each([
    ['leap2026', true],
    ['onlyletters', false],
    ['12345678', false],
    ['a1' + 'x'.repeat(71), false],
  ])('%s → %s', (password, valid) => {
    expect(passwordSchema.safeParse(password).success).toBe(valid);
  });
});

describe('loginSchema', () => {
  it('does not apply strength rules to existing passwords', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('refuses absurdly long passwords before they reach the (deliberately slow) password check', () => {
    expect(rulesOf(loginSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(90_000) }))).toEqual({
      password: ['tooLong'],
    });
    // Anything a real password could be still passes, including longer than today's sign-up limit.
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(256) }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('rejects reusing the current password', () => {
    const result = changePasswordSchema.safeParse({ currentPassword: 'leap2026', newPassword: 'leap2026' });
    expect(rulesOf(result)).toEqual({ newPassword: ['sameAsCurrent'] });
  });
});
