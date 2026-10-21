import * as client from 'openid-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleOAuthProvider } from './google-oauth.provider';
import { OAuthFailedError } from './oauth.types';

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(async () => 'challenge'),
  buildAuthorizationUrl: vi.fn(
    (_config: unknown, parameters: Record<string, string>) =>
      new URL(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(parameters)}`),
  ),
  authorizationCodeGrant: vi.fn(),
}));

const REDIRECT = 'http://localhost:4000/api/v1/auth/google/callback';
const checks = { state: 's', nonce: 'n', codeVerifier: 'v', reauthenticate: false };

describe('GoogleOAuthProvider', () => {
  beforeEach(() => {
    vi.mocked(client.discovery)
      .mockReset()
      .mockResolvedValue({} as client.Configuration);
    vi.mocked(client.authorizationCodeGrant).mockReset();
  });

  it('is configured only with both credentials', () => {
    expect(new GoogleOAuthProvider('id', 'secret', REDIRECT).configured).toBe(true);
    expect(new GoogleOAuthProvider('id', undefined, REDIRECT).configured).toBe(false);
  });

  it('asks for identity only, with PKCE, and a fresh sign-in to confirm a sensitive action', async () => {
    const provider = new GoogleOAuthProvider('id', 'secret', REDIRECT);
    const login = (await provider.authorizationUrl(checks, 'minh@gmail.com')).searchParams;
    expect(Object.fromEntries(login)).toMatchObject({
      redirect_uri: REDIRECT,
      scope: 'openid email profile',
      state: 's',
      nonce: 'n',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      prompt: 'select_account',
      login_hint: 'minh@gmail.com',
    });
    expect(login.has('max_age')).toBe(false);

    const reauth = (await provider.authorizationUrl({ ...checks, reauthenticate: true })).searchParams;
    expect(reauth.get('prompt')).toBe('login');
    expect(reauth.get('max_age')).toBe('0');
    // Discovery is fetched once and reused.
    expect(client.discovery).toHaveBeenCalledOnce();
  });

  it('verifies the answer against the stored checks and returns the identity', async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue({
      claims: () => ({ sub: '123', email: 'Minh@Gmail.com', email_verified: true, name: 'Minh Trần' }),
    } as never);
    const provider = new GoogleOAuthProvider('id', 'secret', REDIRECT);
    const callback = new URL(`${REDIRECT}?code=c&state=s`);

    expect(await provider.exchange(callback, { ...checks, reauthenticate: true })).toEqual({
      subject: '123',
      email: 'minh@gmail.com',
      emailVerified: true,
      name: 'Minh Trần',
    });
    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(expect.anything(), callback, {
      pkceCodeVerifier: 'v',
      expectedState: 's',
      expectedNonce: 'n',
      idTokenExpected: true,
      maxAge: 300,
    });
  });

  it('turns any library failure into OAuthFailedError', async () => {
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(new Error('unexpected ID Token "nonce"'));
    const provider = new GoogleOAuthProvider('id', 'secret', REDIRECT);
    await expect(provider.exchange(new URL(REDIRECT), checks)).rejects.toBeInstanceOf(OAuthFailedError);
  });
});
