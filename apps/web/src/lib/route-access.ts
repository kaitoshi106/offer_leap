/** Cookie set by the API alongside the session tokens (holds no secret, see apps/api auth.cookies.ts). */
export const SESSION_FLAG_COOKIE = 'ol_session';

/** Pages that need a signed-in user. Matching is by path prefix, without the locale. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/analyses',
  '/applications',
  '/interviews',
  '/documents',
  '/settings',
  '/admin',
];
/** Pages that make no sense once signed in. */
const GUEST_ONLY_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export type RouteAccessDecision = { redirect: string } | null;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * @description Optimistic access check run by the proxy before rendering. It only looks at the session flag:
 * the API remains the real gatekeeper, and pages handle a session that turns out to be invalid.
 * @param path - Path without the locale prefix, e.g. `/dashboard`.
 * @param search - Query string including `?`, kept in `next` so users land where they wanted.
 * @param hasSession - Whether the session flag cookie is present.
 * @returns A locale-less redirect target, or `null` to continue.
 */
export function decideRouteAccess(path: string, search: string, hasSession: boolean): RouteAccessDecision {
  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return { redirect: `/login?next=${encodeURIComponent(path + search)}` };
  }
  if (hasSession && GUEST_ONLY_PATHS.some((guestPath) => matchesPrefix(path, guestPath))) {
    return { redirect: '/dashboard' };
  }
  return null;
}
