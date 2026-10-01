import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
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
