import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'ol_at';
export const REFRESH_TOKEN_COOKIE = 'ol_rt';
/**
 * Holds no secret, only "a session probably exists". The refresh cookie is scoped to the auth endpoints, so the web
 * app's proxy can't see it; this flag lets it redirect signed-out visitors before rendering protected pages.
 * The API never trusts it.
 */
const SESSION_FLAG_COOKIE = 'ol_session';
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
 * @description Writes both session cookies.
 * @param response - Express response.
 * @param tokens - Freshly issued tokens.
 * @param secure - Whether to require HTTPS.
 */
export function setSessionCookies(response: Response, tokens: SessionTokens, secure: boolean): void {
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
}

/**
 * @description Removes both session cookies (same name, path and flags they were set with).
 * @param response - Express response.
 * @param secure - Whether the cookies were set as secure.
 */
export function clearSessionCookies(response: Response, secure: boolean): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(secure), path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseOptions(secure), path: REFRESH_COOKIE_PATH });
  response.clearCookie(SESSION_FLAG_COOKIE, { ...baseOptions(secure), path: '/' });
}
