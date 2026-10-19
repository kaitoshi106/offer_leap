import { z } from 'zod';

export const envSchema = z
  .object({
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

    /** Where uploaded files are kept (local disk). Relative paths resolve from the API's working directory. */
    STORAGE_DIR: z.string().default('storage'),

    /** `mock` returns canned answers (tests, offline dev); `gemini` calls Google's Gemini API. */
    AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
    /** Comma-separated models tried in order when the main one is overloaded or rate-limited. */
    GEMINI_FALLBACK_MODELS: z
      .string()
      .default('gemini-3.8-flash,gemini-3.1-flash-lite')
      .transform((value) =>
        value
          .split(',')
          .map((model) => model.trim())
          .filter(Boolean),
      ),
  })
  .refine((env) => env.AI_PROVIDER !== 'gemini' || Boolean(env.GEMINI_API_KEY), {
    message: 'is required when AI_PROVIDER=gemini',
    path: ['GEMINI_API_KEY'],
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
