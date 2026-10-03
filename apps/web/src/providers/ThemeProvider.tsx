'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';
/** Same-tab notification; the native `storage` event only fires in other tabs. */
const PREFERENCE_EVENT = 'offerleap:theme-preference';

function subscribePreference(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(PREFERENCE_EVENT, onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/**
 * @description Persists the preference and notifies subscribers in this tab.
 * @param preference - New preference.
 */
function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the event below still updates this session.
  }
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}

function subscribePrefersDark(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const readPrefersDark = () => window.matchMedia(DARK_QUERY).matches;
const serverPreference = (): ThemePreference => 'system';
const serverPrefersDark = () => false;

/**
 * @description Exposes the theme preference (stored in localStorage) and keeps `<html data-theme>` in sync,
 * following OS changes while the preference is `system`. The first paint is handled by `themeInitScript`.
 * @param children - App subtree.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribePreference, readPreference, serverPreference);
  const prefersDark = useSyncExternalStore(subscribePrefersDark, readPrefersDark, serverPrefersDark);
  const resolvedTheme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference: writePreference }),
    [preference, resolvedTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/**
 * @description Reads the theme context.
 * @returns Current preference, resolved theme and a setter.
 * @throws Error when used outside {@link ThemeProvider}.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
