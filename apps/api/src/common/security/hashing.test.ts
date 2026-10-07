import { describe, expect, it } from 'vitest';

import { generateOpaqueToken, hashPassword, hashToken, verifyPassword } from './hashing';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('leap2026');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'leap2026')).toBe(true);
    expect(await verifyPassword(hash, 'leap2027')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('treats a malformed hash as a mismatch instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('opaque tokens', () => {
  it('are unique, URL-safe and hashed deterministically', () => {
    const token = generateOpaqueToken();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(generateOpaqueToken()).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
  });
});
