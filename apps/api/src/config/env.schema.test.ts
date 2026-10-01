import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      API_PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
    });
  });

  it('coerces numeric strings coming from process.env', () => {
    expect(validateEnv({ API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('throws a readable error for invalid values', () => {
    expect(() => validateEnv({ WEB_ORIGIN: 'not-a-url' })).toThrow(/WEB_ORIGIN/);
  });
});
