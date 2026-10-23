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

/** The choice made in this visit, for when storage is blocked (private modes, strict privacy settings). */
let choiceThisVisit: Theme | null = null;

/**
 * @description The user's theme choice: from localStorage, or — when storage is blocked — the one made during this
 * visit. `null` until they choose.
 */
export function readThemeChoice(): Theme | null {
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? choiceThisVisit;
  } catch {
    return choiceThisVisit;
  }
}

/**
 * @description Saves the choice: in localStorage when allowed, and in memory either way, so the switch still works
 * for the rest of the visit when storage is blocked.
 * @param theme - New theme.
 */
export function storeThemeChoice(theme: Theme): void {
  choiceThisVisit = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: kept in memory only.
  }
}

/**
 * @description Puts the real current theme on `<html>`: the stored choice, else the OS preference. Read straight
 * from storage and matchMedia rather than from React state, which during hydration still holds the
 * server's guess (light) and would briefly repaint a dark page light.
 */
export function applyCurrentTheme(): void {
  const stored = readThemeChoice();
  const theme = resolveTheme(stored, window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  if (root.style.colorScheme !== theme) root.style.colorScheme = theme;
}
