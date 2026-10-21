import type { Response } from 'express';

import { OAUTH_FLOW_TTL_SECONDS } from './oauth.service';

export const OAUTH_FLOW_COOKIE = 'ol_oauth';
/** Only the Google endpoints ever receive the flow cookie. */
const OAUTH_COOKIE_PATH = '/api/v1/auth/google';

/**
 * @description Google's redirect back to this API. It must match a redirect URI registered for the OAuth client.
 * @param apiPublicUrl - Public URL of the API (`API_PUBLIC_URL`).
 */
export function oauthCallbackUrl(apiPublicUrl: string): string {
  return new URL('/api/v1/auth/google/callback', apiPublicUrl).toString();
}

/**
 * @description Stores the signed flow (state, nonce, PKCE verifier) until the callback. `SameSite=Lax` still sends
 * it on Google's top-level redirect back, but not on cross-site requests.
 */
export function setFlowCookie(response: Response, token: string, secure: boolean): void {
  response.cookie(OAUTH_FLOW_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_FLOW_TTL_SECONDS * 1000,
  });
}

/** One flow, one callback: the cookie is removed whatever the outcome. */
export function clearFlowCookie(response: Response, secure: boolean): void {
  response.clearCookie(OAUTH_FLOW_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
  });
}
