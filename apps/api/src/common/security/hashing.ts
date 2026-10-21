import { createHash, randomBytes } from 'node:crypto';

import { hash, verify } from '@node-rs/argon2';

/** OWASP-recommended argon2id baseline (19 MiB, 2 iterations). */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/**
 * @description Hashes a password with argon2id (salt included in the output string).
 * @param password - Plain password.
 * @returns Encoded hash to store.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * @description Checks a password against a stored argon2 hash in constant time.
 * @param passwordHash - Stored hash; `null` for accounts without a password (signed up with Google).
 * @param password - Candidate password.
 * @returns `true` when they match; `false` for a mismatch, a malformed hash or no password at all.
 */
export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (passwordHash === null) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * @description Random, URL-safe token for links and refresh cookies (256 bits of entropy).
 * @returns The raw token to hand to the client.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * @description SHA-256 of a high-entropy token. Enough for random tokens (unlike passwords, which need a slow
 * hash) and lets the database look tokens up by hash.
 * @param token - Raw token.
 * @returns Hex digest to store.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
