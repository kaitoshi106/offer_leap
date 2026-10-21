/** Injection token for the active {@link OAuthProvider} (Google, or the mock under test). */
export const OAUTH_PROVIDER = Symbol('OAUTH_PROVIDER');

/** Who the provider says signed in, after the ID token was verified. */
export interface OAuthIdentity {
  /** The provider's stable user id (`sub`). Accounts are matched by this, never by email. */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** One-time values that tie the callback to the request that started the flow (stored in a signed cookie). */
export interface OAuthChecks {
  /** CSRF protection: must come back unchanged in the callback. */
  state: string;
  /** Replay protection: must be inside the ID token. */
  nonce: string;
  /** PKCE: proves the code is redeemed by whoever asked for it. */
  codeVerifier: string;
  /** Force a fresh sign-in at the provider (confirming a sensitive action), not a remembered session. */
  reauthenticate: boolean;
}

/**
 * Strategy for an OpenID Connect sign-in provider, so the flow and its account rules can be tested without
 * Google (like `AiProvider` for the AI vendor).
 */
export interface OAuthProvider {
  /** Whether credentials are set; without them the flow is refused and the web app hides the button. */
  readonly configured: boolean;
  /** Where to send the browser to sign in. */
  authorizationUrl(checks: OAuthChecks, loginHint?: string): Promise<URL>;
  /**
   * Redeems the code in the callback URL and verifies the ID token (issuer, audience, expiry, nonce; a recent
   * sign-in when `reauthenticate`).
   * @throws OAuthFailedError when anything doesn't match.
   */
  exchange(callbackUrl: URL, checks: OAuthChecks): Promise<OAuthIdentity>;
}

/** The provider rejected the flow or its answer didn't verify. The user just starts again. */
export class OAuthFailedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OAuthFailedError';
  }
}
