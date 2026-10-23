'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { applyCurrentTheme, readThemeChoice, resolveTheme, storeThemeChoice, type Theme } from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';
/** Same-tab notification; the native `storage` event only fires in other tabs. */
const THEME_EVENT = 'offerleap:theme';

function subscribeStoredTheme(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/**
 * @description Persists the choice and notifies subscribers in this tab.
 * @param theme - New theme.
 */
function writeTheme(theme: Theme): void {
  storeThemeChoice(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribePrefersDark(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const readPrefersDark = () => window.matchMedia(DARK_QUERY).matches;
const serverStoredTheme = (): Theme | null => null;
const serverPrefersDark = () => false;

/**
 * @description Light/dark theme. Until the user picks one it follows the OS; afterwards the choice is stored in
 * localStorage. Keeps `<html data-theme>` in sync; the first paint is handled by `themeInitScript`.
 * @param children - App subtree.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribeStoredTheme, readThemeChoice, serverStoredTheme);
  const prefersDark = useSyncExternalStore(subscribePrefersDark, readPrefersDark, serverPrefersDark);
  const theme = resolveTheme(stored, prefersDark);

  // When the theme changes (the switch, the OS setting, another tab), put it on <html> before the next paint.
  // `applyCurrentTheme` reads the real value, not `theme`: during hydration `theme` is still the server's guess.
  // (Re-renders of the root layout, which wipe the attribute, are handled earlier by `ThemeScript`.)
  useLayoutEffect(applyCurrentTheme, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: writeTheme,
      toggleTheme: () => writeTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/**
 * @description Reads the theme context.
 * @returns Current theme and setters.
 * @throws Error when used outside {@link ThemeProvider}.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
