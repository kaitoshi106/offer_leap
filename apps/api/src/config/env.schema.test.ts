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

  it('derives the API public URL and picks the mock sign-in only under test', () => {
    expect(validateEnv({ ...REQUIRED, API_PORT: '4100' })).toMatchObject({
      API_PUBLIC_URL: 'http://localhost:4100',
      OAUTH_PROVIDER: 'google',
    });
    expect(validateEnv({ ...REQUIRED, NODE_ENV: 'test' }).OAUTH_PROVIDER).toBe('mock');
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'production', OAUTH_PROVIDER: 'mock' })).toThrow(
      /OAUTH_PROVIDER/,
    );
  });

  it('reads which proxies to trust for the client IP (rate limits are per IP), trusting none by default', () => {
    expect(validateEnv(REQUIRED).TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...REQUIRED, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(validateEnv({ ...REQUIRED, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(validateEnv({ ...REQUIRED, TRUST_PROXY: 'loopback, 10.0.0.0/8' }).TRUST_PROXY).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('keeps queues of separate test runs apart when asked to', () => {
    expect(validateEnv(REQUIRED).QUEUE_PREFIX).toBe('bull');
    expect(validateEnv({ ...REQUIRED, NODE_ENV: 'test' }).QUEUE_PREFIX).toBe('bull-test');
    expect(validateEnv({ ...REQUIRED, NODE_ENV: 'test', QUEUE_PREFIX: 'bull-e2e' }).QUEUE_PREFIX).toBe(
      'bull-e2e',
    );
  });
});
