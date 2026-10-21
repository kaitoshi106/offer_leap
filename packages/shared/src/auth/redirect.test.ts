import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/onboarding', '/onboarding'],
    ['/admin/users?page=2', '/admin/users?page=2'],
    [null, '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
