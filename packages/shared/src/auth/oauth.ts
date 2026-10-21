/** Sign-in providers besides email + password. */
export const IdentityProvider = {
  GOOGLE: 'GOOGLE',
} as const;
export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];

/**
 * Why a Google flow is started: sign in (or sign up), link Google to the signed-in account, or confirm deleting
 * the signed-in account (for accounts without a password, instead of typing one).
 */
export const OAUTH_INTENTS = ['login', 'link', 'delete'] as const;
export type OAuthIntent = (typeof OAUTH_INTENTS)[number];

/** Ways an account can sign in: its password, or a linked provider. */
export type SignInMethod = 'PASSWORD' | IdentityProvider;

/** `GET /auth/providers`: which sign-in providers the API has credentials for (the web app hides the others). */
export interface AuthProviders {
  google: boolean;
}

/** `GET /auth/sign-in-methods`: how the signed-in user can sign in (settings page). */
export interface SignInMethods {
  hasPassword: boolean;
  identities: { provider: IdentityProvider; email: string; createdAt: string }[];
}
