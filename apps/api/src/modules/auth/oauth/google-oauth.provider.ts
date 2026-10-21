import { Logger } from '@nestjs/common';
import * as client from 'openid-client';

import { type OAuthChecks, OAuthFailedError, type OAuthIdentity, type OAuthProvider } from './oauth.types';

const GOOGLE_ISSUER = new URL('https://accounts.google.com');
/** Identity only: no access to the user's Google data is asked for or kept. */
const SCOPE = 'openid email profile';
/** How old a sign-in may be when it confirms a sensitive action (deleting the account). */
const REAUTH_MAX_AGE_SECONDS = 300;

/**
 * Google as an OpenID Connect provider, through `openid-client` (a certified OIDC client): discovery, PKCE, state
 * and nonce checks and ID-token verification come from the library rather than hand-written code.
 */
export class GoogleOAuthProvider implements OAuthProvider {
  readonly configured: boolean;
  private readonly logger = new Logger(GoogleOAuthProvider.name);
  private config?: Promise<client.Configuration>;

  constructor(
    private readonly clientId: string | undefined,
    private readonly clientSecret: string | undefined,
    private readonly redirectUri: string,
  ) {
    this.configured = Boolean(clientId && clientSecret);
  }

  async authorizationUrl(checks: OAuthChecks, loginHint?: string): Promise<URL> {
    const parameters: Record<string, string> = {
      redirect_uri: this.redirectUri,
      scope: SCOPE,
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(checks.codeVerifier),
      code_challenge_method: 'S256',
      // Let the user pick an account instead of silently using the one signed in to the browser.
      prompt: checks.reauthenticate ? 'login' : 'select_account',
    };
    if (checks.reauthenticate) parameters.max_age = '0';
    if (loginHint) parameters.login_hint = loginHint;
    return client.buildAuthorizationUrl(await this.discover(), parameters);
  }

  async exchange(callbackUrl: URL, checks: OAuthChecks): Promise<OAuthIdentity> {
    try {
      const tokens = await client.authorizationCodeGrant(await this.discover(), callbackUrl, {
        pkceCodeVerifier: checks.codeVerifier,
        expectedState: checks.state,
        expectedNonce: checks.nonce,
        idTokenExpected: true,
        maxAge: checks.reauthenticate ? REAUTH_MAX_AGE_SECONDS : undefined,
      });
      const claims = tokens.claims();
      if (!claims || typeof claims.email !== 'string')
        throw new OAuthFailedError('ID token without an email');
      return {
        subject: claims.sub,
        email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === 'string' ? claims.name : null,
      };
    } catch (error) {
      if (error instanceof OAuthFailedError) throw error;
      // The library's message says what didn't match; it is logged, never shown to the user.
      this.logger.warn(`Google sign-in failed: ${(error as Error).message}`);
      throw new OAuthFailedError('Google sign-in failed', { cause: error });
    }
  }

  /** Google's endpoints and keys, fetched once and reused (retried on the next call if it failed). */
  private discover(): Promise<client.Configuration> {
    this.config ??= client
      .discovery(GOOGLE_ISSUER, this.clientId!, this.clientSecret!)
      .catch((error: unknown) => {
        this.config = undefined;
        throw new OAuthFailedError('Google discovery failed', { cause: error });
      });
    return this.config;
  }
}
