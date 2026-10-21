# 0006 — Sign in with Google (OpenID Connect)

## Context

Users asked to sign up and sign in with Google instead of creating another password. The app already has
email + password accounts with verified emails, cookie sessions (JWT access + rotating refresh token), a root admin
managed by config, invited general admins, and a password-confirmed account deletion.

## Decision

- **Authorization Code flow with PKCE, handled entirely by the API** (confidential client): the browser navigates
  to `GET /auth/google`, Google redirects back to `/auth/google/callback`, the API sets the usual session cookies
  and redirects to the web app. No Google token reaches the browser and none is stored (scope `openid email profile`).
- **`openid-client`** (certified OIDC library) does discovery, PKCE, state, nonce and ID-token verification.
  Not Passport: its session model would sit beside the existing cookie sessions.
- State, nonce and PKCE verifier travel in a **signed, 10-minute, httpOnly cookie** (`ol_oauth`, path
  `/api/v1/auth/google`, `SameSite=Lax` so Google's top-level redirect still carries it). The signing key is the
  JWT key with an audience; the access-token guard rejects any token that has an audience.
- **`user_identities` table** (`provider`, `providerUserId` = Google `sub`): accounts are matched by `sub`, never by
  email after the first link. `users.passwordHash` becomes nullable.
- **Account rules** (sign-in):
  - Google email not verified → refused.
  - Linked `sub` → that user. Else an account with the same email: verified → linked, and the owner gets an email;
    unverified → linked, its password removed and its sessions revoked (pre-hijacking protection). Else a new USER,
    email verified, sent to onboarding.
  - **Admins (root and general) never sign in with Google** (`canUseSignInProviders`), disabled accounts are refused.
- **Settings**: link Google (a flow for the signed-in user, started by a form POST so a link from another site can't
  start it), unlink only when a password exists, set a password through the reset email. **Deleting a
  Google-only account** is confirmed by a fresh Google sign-in (`prompt=login`, `max_age`) with the linked account.
- **Testing**: an `OAuthProvider` strategy with a `mock` implementation (`OAUTH_PROVIDER=mock`, refused in
  production) that skips Google's page but still checks state and nonce, so API e2e and Playwright cover the flows.

## Consequences

- One more way in, without a second session system; errors come back to the web app as `?error=<code>` and are
  translated like any API error.
- Production needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and the callback URL registered at Google
  (`API_PUBLIC_URL` + `/api/v1/auth/google/callback`); without them the button is hidden.
- Adding another provider (GitHub, LinkedIn) means a new `IdentityProvider` value and an `OAuthProvider`
  implementation; the account rules stay.
