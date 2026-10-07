import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  /** Access token lifetime in seconds. */
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  /** Refresh token (session) lifetime in days. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('OfferLeap <no-reply@offerleap.local>'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * @description Validates `process.env` once at boot so a misconfigured deploy fails fast
 * instead of crashing on the first request that reads a missing value.
 * @param config - Raw key/value pairs loaded by `@nestjs/config`.
 * @returns The parsed, typed environment with defaults applied.
 * @throws Error listing every invalid variable.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
