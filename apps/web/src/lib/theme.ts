export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const THEME_STORAGE_KEY = 'offerleap-theme';

/**
 * @description Narrows a stored value to a theme preference, falling back to `system`.
 * @param value - Raw value from storage.
 * @returns A valid {@link ThemePreference}.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : 'system';
}

/**
 * @description Resolves `system` to the OS colour scheme.
 * @param preference - The user's choice.
 * @param prefersDark - Result of the `(prefers-color-scheme: dark)` media query.
 * @returns The theme to apply.
 */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Runs inline in `<head>` before the first paint so the page never flashes the wrong theme.
 * Kept dependency-free and wrapped in try/catch because storage can be blocked.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='light'||p==='dark'?p:(d?'dark':'light');var e=document.documentElement;e.dataset.theme=t;e.style.colorScheme=t;}catch(_){}})();`;
