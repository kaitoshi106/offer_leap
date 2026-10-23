import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    /** Public URL of this API (without `/api/v1`), used for OAuth callbacks. Default: http://localhost:API_PORT. */
    API_PUBLIC_URL: z.url().optional(),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url().default('redis://localhost:6379'),
    /**
     * Prefix of the job queues in Redis. Default `bull`, or `bull-test` under NODE_ENV=test so test runs don't
     * hand their jobs to `pnpm dev`; two test setups sharing Redis (API e2e and a browser-test server) need
     * different ones.
     */
    QUEUE_PREFIX: z.string().min(1).optional(),
    /**
     * Express `trust proxy`: which proxies in front of the API may set the client IP (`X-Forwarded-For`). Rate
     * limits and session records use that IP, so behind a load balancer set it (e.g. `1` for one hop, or its
     * addresses); otherwise every user looks like the proxy and shares one limit. Default: trust none.
     */
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value): boolean | number | string => {
        if (!value || value === 'false') return false;
        if (value === 'true') return true;
        return /^\d+$/.test(value) ? Number(value) : value;
      }),

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

    /**
     * Where uploaded files go: `disk` (under STORAGE_DIR) or `database` (Postgres) for hosts whose disk is wiped on
     * restart, such as free tiers.
     */
    STORAGE_DRIVER: z.enum(['disk', 'database']).default('disk'),
    /** Upload folder for STORAGE_DRIVER=disk. Relative paths resolve from the API's working directory. */
    STORAGE_DIR: z.string().default('storage'),

    /** `mock` returns canned answers (tests, offline dev); `gemini` calls Google's Gemini API. */
    AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
    /** Comma-separated models tried in order when the main one is overloaded or rate-limited. */
    GEMINI_FALLBACK_MODELS: z
      .string()
      .default('gemini-3.1-flash-lite,gemini-3.8-flash')
      .transform((value) =>
        value
          .split(',')
          .map((model) => model.trim())
          .filter(Boolean),
      ),
    /** Embedding model for personal documents (RAG). Changing it requires re-processing the documents. */
    GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
    /** Successful AI calls a user may make per rolling 24 hours (admins can override per user). */
    AI_DAILY_QUOTA: z.coerce.number().int().min(0).default(50),

    /**
     * Sign in with Google. `google` needs GOOGLE_CLIENT_ID/SECRET (without them the button is hidden); `mock` signs
     * in a fake Google account for tests and is refused in production. Default: `mock` under NODE_ENV=test.
     */
    OAUTH_PROVIDER: z.enum(['google', 'mock']).optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })
  .refine((env) => env.AI_PROVIDER !== 'gemini' || Boolean(env.GEMINI_API_KEY), {
    message: 'is required when AI_PROVIDER=gemini',
    path: ['GEMINI_API_KEY'],
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.OAUTH_PROVIDER === 'mock'), {
    message: 'mock sign-in is not allowed in production',
    path: ['OAUTH_PROVIDER'],
  })
  .transform((env) => ({
    ...env,
    API_PUBLIC_URL: env.API_PUBLIC_URL ?? `http://localhost:${env.API_PORT}`,
    OAUTH_PROVIDER: env.OAUTH_PROVIDER ?? (env.NODE_ENV === 'test' ? 'mock' : 'google'),
    QUEUE_PREFIX: env.QUEUE_PREFIX ?? (env.NODE_ENV === 'test' ? 'bull-test' : 'bull'),
  }));

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
