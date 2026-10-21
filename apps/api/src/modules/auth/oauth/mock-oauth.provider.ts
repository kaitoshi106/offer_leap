import { type OAuthChecks, OAuthFailedError, type OAuthIdentity, type OAuthProvider } from './oauth.types';

/** Fake account used when the flow starts without a `loginHint`. */
const MOCK_OAUTH_DEFAULT_EMAIL = 'google.user@example.com';

interface MockCode {
  email: string;
  nonce: string;
}

/**
 * Stand-in for Google in tests (`OAUTH_PROVIDER=mock`, refused in production). The "authorization page" is skipped:
 * the browser goes straight to the callback with a code naming the account (`loginHint`). Emails starting with
 * `unverified` come back unverified. State and nonce are still checked, so the real flow's protections are tested.
 */
export class MockOAuthProvider implements OAuthProvider {
  readonly configured = true;

  constructor(private readonly redirectUri: string) {}

  async authorizationUrl(checks: OAuthChecks, loginHint?: string): Promise<URL> {
    const code: MockCode = {
      email: (loginHint ?? MOCK_OAUTH_DEFAULT_EMAIL).toLowerCase(),
      nonce: checks.nonce,
    };
    const url = new URL(this.redirectUri);
    url.searchParams.set('code', Buffer.from(JSON.stringify(code)).toString('base64url'));
    url.searchParams.set('state', checks.state);
    return url;
  }

  async exchange(callbackUrl: URL, checks: OAuthChecks): Promise<OAuthIdentity> {
    if (callbackUrl.searchParams.get('state') !== checks.state) throw new OAuthFailedError('state mismatch');
    let code: MockCode;
    try {
      code = JSON.parse(
        Buffer.from(callbackUrl.searchParams.get('code') ?? '', 'base64url').toString(),
      ) as MockCode;
    } catch {
      throw new OAuthFailedError('invalid code');
    }
    if (code.nonce !== checks.nonce) throw new OAuthFailedError('nonce mismatch');
    return {
      subject: `mock|${code.email}`,
      email: code.email,
      emailVerified: !code.email.startsWith('unverified'),
      name: code.email.split('@')[0]!.replace(/[._]/g, ' '),
    };
  }
}
