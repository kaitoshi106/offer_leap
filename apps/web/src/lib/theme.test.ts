import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyCurrentTheme,
  parseStoredTheme,
  readThemeChoice,
  resolveTheme,
  storeThemeChoice,
} from './theme';

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

describe('theme choice when storage is blocked', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is remembered for the rest of the visit, and applied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    storeThemeChoice('dark');

    expect(readThemeChoice()).toBe('dark');
    applyCurrentTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
