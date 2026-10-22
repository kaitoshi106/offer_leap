import { ONBOARDING_FLAG_COOKIE, type OnboardingFlag, SESSION_FLAG_COOKIE } from '@offerleap/shared';
import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'ol_at';
export const REFRESH_TOKEN_COOKIE = 'ol_rt';
// Flag cookies for the web app's proxy (`SESSION_FLAG_COOKIE`, `ONBOARDING_FLAG_COOKIE`): no secrets, never trusted
// by the API. The refresh cookie is scoped to the auth endpoints, so the proxy can't see it; the flags let it
// redirect before rendering (signed out → login, onboarding pending ↔ done).
/** The refresh cookie is only sent to auth endpoints, never with ordinary API calls. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * @description Shared cookie flags: unreadable by JS (`httpOnly`), HTTPS-only in production, and `SameSite=Lax`
 * so other sites can't make the browser send them with a cross-site POST (CSRF).
 * @param secure - Whether to require HTTPS.
 */
function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax' };
}

/**
 * @description Writes the session cookies and the proxy's flags.
 * @param response - Express response.
 * @param tokens - Freshly issued tokens.
 * @param secure - Whether to require HTTPS.
 * @param onboarding - Whether the account still has to onboard (see `onboardingFlag`).
 */
export function setSessionCookies(
  response: Response,
  tokens: SessionTokens,
  secure: boolean,
  onboarding: OnboardingFlag,
): void {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(secure),
    path: '/',
    expires: tokens.accessTokenExpiresAt,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshTokenExpiresAt,
  });
  response.cookie(SESSION_FLAG_COOKIE, '1', {
    ...baseOptions(secure),
    path: '/',
    expires: tokens.refreshTokenExpiresAt,
  });
  setOnboardingFlagCookie(response, onboarding, secure, tokens.refreshTokenExpiresAt);
}

/**
 * @description Updates the onboarding flag alone (e.g. when onboarding is finished), keeping the session's lifetime.
 * @param response - Express response.
 * @param onboarding - New value.
 * @param secure - Whether to require HTTPS.
 * @param expires - When the session ends (the flag lives as long as the session flag).
 */
export function setOnboardingFlagCookie(
  response: Response,
  onboarding: OnboardingFlag,
  secure: boolean,
  expires: Date,
): void {
  response.cookie(ONBOARDING_FLAG_COOKIE, onboarding, { ...baseOptions(secure), path: '/', expires });
}

/**
 * @description Removes the session cookies and the flags (same name, path and options they were set with).
 * @param response - Express response.
 * @param secure - Whether the cookies were set as secure.
 */
export function clearSessionCookies(response: Response, secure: boolean): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(secure), path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseOptions(secure), path: REFRESH_COOKIE_PATH });
  response.clearCookie(SESSION_FLAG_COOKIE, { ...baseOptions(secure), path: '/' });
  response.clearCookie(ONBOARDING_FLAG_COOKIE, { ...baseOptions(secure), path: '/' });
}
