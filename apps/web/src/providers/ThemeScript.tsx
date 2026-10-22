'use client';

import { useLayoutEffect } from 'react';

import { InlineScript } from '@/lib/inline-script';
import { applyCurrentTheme, themeInitScript } from '@/lib/theme';

/**
 * @description Keeps `<html data-theme>` right at all times:
 * - on full page loads, the inline script applies it before the first paint;
 * - when the root layout re-renders (switching the language), React 19 resets `<html>` to the attributes it
 *   renders, dropping `data-theme`. This component sits in `<head>`, before everything in `<body>`, so its layout
 *   effect — run on every render, before any other component's — restores it in the same commit, before the
 *   browser recalculates styles. Otherwise colour transitions would flash to light and back.
 */
export function ThemeScript() {
  useLayoutEffect(applyCurrentTheme);
  return <InlineScript html={themeInitScript} />;
}
