import { isLocale } from '@offerleap/shared';
import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { decideRouteAccess, SESSION_FLAG_COOKIE } from './lib/route-access';

const handleI18nRouting = createMiddleware(routing);

/**
 * @description Runs before every page: redirects signed-out visitors away from protected pages (and signed-in
 * users away from login/register), then lets next-intl handle the locale (`/` → `/vi` or `/en`, locale cookie).
 * @param request - Incoming request.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split('/');

  if (isLocale(locale)) {
    const decision = decideRouteAccess(
      `/${rest.join('/')}`,
      search,
      request.cookies.has(SESSION_FLAG_COOKIE),
    );
    if (decision) return NextResponse.redirect(new URL(`/${locale}${decision.redirect}`, request.url));
  }

  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts…).
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
