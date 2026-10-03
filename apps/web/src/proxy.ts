import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/** Redirects `/` to `/{locale}` (from cookie or Accept-Language) and keeps the locale cookie in sync. */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts…).
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
