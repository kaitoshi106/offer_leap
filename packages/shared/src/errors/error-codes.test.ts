import { describe, expect, it } from 'vitest';

import { isApiErrorResponse } from './api-error';
import { ERROR_HTTP_STATUS, ErrorCode, isErrorCode } from './error-codes';

const KNOWN_DOMAINS = [
  'COMMON',
  'AUTH',
  'ADMIN',
  'ONBOARDING',
  'RESUME',
  'ANALYSIS',
  'INTERVIEW',
  'AI',
  'TAXONOMY',
];

describe('ErrorCode registry', () => {
  it.each(Object.entries(ErrorCode))('%s has a key equal to its value', (key, value) => {
    expect(value).toBe(key);
  });

  it.each(Object.values(ErrorCode))('%s follows <DOMAIN>_<REASON> naming', (code) => {
    expect(code).toMatch(/^[A-Z]+(_[A-Z0-9]+)+$/);
    expect(KNOWN_DOMAINS).toContain(code.split('_')[0]);
  });

  it.each(Object.values(ErrorCode))('%s maps to a 4xx/5xx status', (code) => {
    expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    expect(ERROR_HTTP_STATUS[code]).toBeLessThan(600);
  });
});

describe('isErrorCode', () => {
  it('accepts registered codes and rejects anything else', () => {
    expect(isErrorCode('AUTH_EMAIL_TAKEN')).toBe(true);
    expect(isErrorCode('AUTH_SOMETHING_ELSE')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});

describe('isApiErrorResponse', () => {
  it('recognises the API error body shape', () => {
    expect(isApiErrorResponse({ statusCode: 409, code: 'AUTH_EMAIL_TAKEN', message: 'taken' })).toBe(true);
    expect(isApiErrorResponse({ statusCode: 409, code: 'NOPE' })).toBe(false);
    expect(isApiErrorResponse(null)).toBe(false);
  });
});
