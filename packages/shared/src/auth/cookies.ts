import { Role } from './roles';

/**
 * Cookies the API sets next to the session tokens for the web app's proxy. They hold no secret — only hints that
 * let it redirect before rendering a page. The API never trusts them; it checks every request itself.
 */

/** "A session probably exists" (signed-out visitors of protected pages go to login). */
export const SESSION_FLAG_COOKIE = 'ol_session';

/**
 * Whether the account still has to finish onboarding (`pending`) or not (`done`: finished, or an admin, who never
 * onboards). Absent means unknown (a session from before the flag existed): the page decides, as before.
 */
export const ONBOARDING_FLAG_COOKIE = 'ol_onboarding';

export type OnboardingFlag = 'pending' | 'done';

/**
 * @description The onboarding flag for an account: only USER accounts onboard.
 * @param account - Role and whether onboarding is complete.
 */
export function onboardingFlag(account: { role: Role; onboardingCompleted: boolean }): OnboardingFlag {
  return account.role === Role.USER && !account.onboardingCompleted ? 'pending' : 'done';
}
