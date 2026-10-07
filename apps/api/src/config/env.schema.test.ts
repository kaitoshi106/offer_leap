import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(validateEnv(REQUIRED)).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_TTL: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
  });

  it('coerces numeric strings coming from process.env', () => {
    expect(validateEnv({ ...REQUIRED, API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('throws a readable error for invalid values', () => {
    expect(() => validateEnv({ ...REQUIRED, WEB_ORIGIN: 'not-a-url' })).toThrow(/WEB_ORIGIN/);
  });

  it('requires a database URL and a long enough JWT secret', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET/);
  });
});
