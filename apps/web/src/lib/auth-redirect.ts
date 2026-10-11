'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';

import { getPathname } from '@/i18n/navigation';

/**
 * @description Full page navigation for moments when the session changes (sign in, verify email, sign out).
 * Client-side navigation could reuse Router Cache entries computed with the old cookies — e.g. the proxy's
 * "/login → /dashboard" redirect from while the user was signed in — and in-memory state of the previous user.
 * A full load sends a fresh request with the new cookies.
 * @returns `(href) => void`, where `href` is a locale-less path such as `/dashboard`.
 */
export function useAuthRedirect(): (href: string) => void {
  const locale = useLocale();
  return useCallback((href: string) => window.location.assign(getPathname({ href, locale })), [locale]);
}
