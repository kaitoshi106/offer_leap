'use client';

import { InlineScript } from '@/lib/inline-script';
import { themeInitScript } from '@/lib/theme';

/**
 * @description Applies the stored theme before the first paint on full page loads. Client-side navigations
 * don't need it: `ThemeProvider` already keeps `<html data-theme>` in sync.
 */
export function ThemeScript() {
  return <InlineScript html={themeInitScript} />;
}
