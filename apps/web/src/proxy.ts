import {
  isLocale,
  ONBOARDING_FLAG_COOKIE,
  type OnboardingFlag,
  SESSION_FLAG_COOKIE,
} from '@offerleap/shared';
import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { decideRouteAccess } from './lib/route-access';

const handleI18nRouting = createMiddleware(routing);

/** Only the two known values count; anything else is treated as unknown. */
const parseOnboardingFlag = (value: string | undefined): OnboardingFlag | undefined =>
  value === 'pending' || value === 'done' ? value : undefined;

/**
 * @description Runs before every page: redirects signed-out visitors away from protected pages, signed-in users
 * away from login/register, and between onboarding and the app by the onboarding flag — all before anything
 * renders — then lets next-intl handle the locale (`/` → `/vi` or `/en`, locale cookie).
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
      parseOnboardingFlag(request.cookies.get(ONBOARDING_FLAG_COOKIE)?.value),
    );
    if (decision) return NextResponse.redirect(new URL(`/${locale}${decision.redirect}`, request.url));
  }

  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts…).
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
