const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'offerleap-theme';

/**
 * @description Reads a stored theme. Anything else (nothing stored, old values such as "system") means the user
 * hasn't chosen yet.
 * @param value - Raw value from storage.
 * @returns The stored theme or `null`.
 */
export function parseStoredTheme(value: unknown): Theme | null {
  return THEMES.includes(value as Theme) ? (value as Theme) : null;
}

/**
 * @description The theme to show: the user's choice, or the OS colour scheme until they pick one.
 * @param stored - Stored choice, if any.
 * @param prefersDark - Result of the `(prefers-color-scheme: dark)` media query.
 */
export function resolveTheme(stored: Theme | null, prefersDark: boolean): Theme {
  return stored ?? (prefersDark ? 'dark' : 'light');
}

/**
 * Runs inline in `<head>` before the first paint so the page never flashes the wrong theme (even when following
 * the OS). Kept dependency-free and wrapped in try/catch because storage can be blocked.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='light'||p==='dark'?p:(d?'dark':'light');var e=document.documentElement;e.dataset.theme=t;e.style.colorScheme=t;}catch(_){}})();`;
