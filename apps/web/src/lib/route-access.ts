import type { OnboardingFlag } from '@offerleap/shared';

/** Pages that need a signed-in user. Matching is by path prefix, without the locale. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/analyses',
  '/applications',
  '/interviews',
  '/documents',
  '/profile',
  '/settings',
  '/admin',
];
/** Pages that make no sense once signed in. */
const GUEST_ONLY_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const ONBOARDING_PATH = '/onboarding';

export type RouteAccessDecision = { redirect: string } | null;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * @description Optimistic access check run by the proxy before rendering, from the API's flag cookies only: the
 * API remains the real gatekeeper, and pages still handle a session that turns out to be invalid.
 * - signed out → protected pages go to login; signed in → guest-only pages go to the dashboard;
 * - onboarding `done` → `/onboarding` goes to the dashboard; `pending` → every other app page goes to onboarding.
 *   Without the flag (a session from before it existed) nothing is decided here; the page handles it.
 * @param path - Path without the locale prefix, e.g. `/dashboard`.
 * @param search - Query string including `?`, kept in `next` so users land where they wanted.
 * @param hasSession - Whether the session flag cookie is present.
 * @param onboarding - The onboarding flag cookie, if present.
 * @returns A locale-less redirect target, or `null` to continue.
 */
export function decideRouteAccess(
  path: string,
  search: string,
  hasSession: boolean,
  onboarding?: OnboardingFlag,
): RouteAccessDecision {
  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return { redirect: `/login?next=${encodeURIComponent(path + search)}` };
  }
  if (hasSession && GUEST_ONLY_PATHS.some((guestPath) => matchesPrefix(path, guestPath))) {
    return { redirect: '/dashboard' };
  }
  if (hasSession && onboarding === 'done' && matchesPrefix(path, ONBOARDING_PATH)) {
    return { redirect: '/dashboard' };
  }
  if (
    hasSession &&
    onboarding === 'pending' &&
    !matchesPrefix(path, ONBOARDING_PATH) &&
    PROTECTED_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
  ) {
    return { redirect: ONBOARDING_PATH };
  }
  return null;
}
