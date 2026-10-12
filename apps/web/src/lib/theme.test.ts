import { describe, expect, it } from 'vitest';

import { parseStoredTheme, resolveTheme } from './theme';

describe('theme helpers', () => {
  it('only accepts light or dark as a stored choice', () => {
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('system')).toBeNull();
    expect(parseStoredTheme(null)).toBeNull();
  });

  it('follows the OS until the user picks a theme', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });
});
