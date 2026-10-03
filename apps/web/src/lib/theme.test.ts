import { describe, expect, it } from 'vitest';

import { parseThemePreference, resolveTheme } from './theme';

describe('theme helpers', () => {
  it('falls back to system for unknown stored values', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('purple')).toBe('system');
    expect(parseThemePreference(null)).toBe('system');
  });

  it('resolves system from the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });
});
