import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type AuthProviders,
  canUseSignInProviders,
  ErrorCode,
  IdentityProvider,
  type Locale,
  type OAuthIntent,
  type OAuthStartQuery,
  safeRedirectPath,
  type SignInMethods,
} from '@offerleap/shared';
import * as client from 'openid-client';

import { AppException } from '../../../common/errors/app.exception';
import { isUniqueViolation } from '../../../common/errors/prisma-errors';
import type { ClientInfo } from '../../../common/http/request';
import type { Env } from '../../../config/env.schema';
import type { User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountService } from '../../account/account.service';
import { MailService } from '../../mail/mail.service';
import { AuthService, type SessionResult } from '../auth.service';
import { TokenService } from '../token.service';
import {
  type OAuthChecks,
  OAuthFailedError,
  type OAuthIdentity,
  OAUTH_PROVIDER,
  type OAuthProvider,
} from './oauth.types';

/** Signed contents of the short-lived cookie that carries the flow from start to callback. */
interface OAuthFlow {
  intent: OAuthIntent;
  locale: Locale;
  next?: string;
  /** The signed-in user who started a `link` or `delete` flow. */
  userId?: string;
  checks: OAuthChecks;
}

/** What the controller does after the callback: set a session or sign out, then send the browser on. */
export interface OAuthOutcome {
  redirectTo: string;
  session?: SessionResult;
  signOut?: boolean;
}

/** Long enough to sign in at Google, short enough that a leaked cookie is useless soon. */
export const OAUTH_FLOW_TTL_SECONDS = 600;
const FLOW_AUDIENCE = 'oauth-flow';

/**
 * Sign in with Google: starts the flow, then applies the account rules in the callback — create or find the
 * account, link Google to the signed-in user, or confirm deleting it. Matching is by Google's stable id; an email
 * match links only when Google has verified that email, and admins never sign in this way.
 */
@Injectable()
export class OAuthService {
  private readonly webOrigin: string;

  constructor(
    @Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly account: AccountService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  providers(): AuthProviders {
    return { google: this.provider.configured };
  }

  /**
   * @description Starts a flow: fresh state, nonce and PKCE verifier, signed into a cookie value, and the Google
   * URL to send the browser to.
   * @param intent - `login` (anyone) or `link` / `delete` (signed-in user, `userId` required).
   * @throws AppException AUTH_OAUTH_NOT_CONFIGURED.
   */
  async start(
    intent: OAuthIntent,
    query: OAuthStartQuery,
    userId?: string,
  ): Promise<{ url: string; flowToken: string }> {
    if (!this.provider.configured) throw new AppException(ErrorCode.AUTH_OAUTH_NOT_CONFIGURED);
    const flow: OAuthFlow = {
      intent,
      locale: query.locale,
      next: query.next,
      userId,
      checks: {
        state: client.randomState(),
        nonce: client.randomNonce(),
        codeVerifier: client.randomPKCECodeVerifier(),
        reauthenticate: intent === 'delete',
      },
    };
    const url = await this.provider.authorizationUrl(flow.checks, query.loginHint);
    const flowToken = await this.jwt.signAsync(
      { ...flow },
      { audience: FLOW_AUDIENCE, expiresIn: OAUTH_FLOW_TTL_SECONDS, jwtid: randomUUID() },
    );
    return { url: url.toString(), flowToken };
  }

  /**
   * @description Handles Google's redirect back. Never throws: every failure becomes a redirect to the login page
   * (or settings, for link/delete) with an error code the web app translates.
   * @param callbackUrl - The callback URL as Google called it (code, state, or error).
   * @param flowToken - Cookie set by {@link start}; missing or expired means the flow can't be trusted.
   * @param client - Session metadata.
   */
  async finish(callbackUrl: URL, flowToken: string | undefined, client: ClientInfo): Promise<OAuthOutcome> {
    const flow = await this.readFlow(flowToken);
    if (!flow) return { redirectTo: this.webUrl('vi', '/login', { error: ErrorCode.AUTH_OAUTH_FAILED }) };
    const back = flow.intent === 'login' ? '/login' : '/settings';
    // The user pressed "Cancel" at Google: back where they came from, nothing to report.
    if (callbackUrl.searchParams.has('error')) return { redirectTo: this.webUrl(flow.locale, back) };

    try {
      const identity = await this.provider.exchange(callbackUrl, flow.checks);
      if (!identity.emailVerified) throw new AppException(ErrorCode.AUTH_OAUTH_EMAIL_UNVERIFIED);
      if (flow.intent === 'link') return await this.link(flow, identity);
      if (flow.intent === 'delete') return await this.confirmDelete(flow, identity);
      return await this.signIn(flow, identity, client);
    } catch (error) {
      const code =
        error instanceof AppException
          ? error.code
          : error instanceof OAuthFailedError
            ? ErrorCode.AUTH_OAUTH_FAILED
            : null;
      if (!code) throw error;
      return { redirectTo: this.webUrl(flow.locale, back, { error: code }) };
    }
  }

  /** How the user can sign in (settings page). */
  async signInMethods(userId: string): Promise<SignInMethods> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { identities: true } });
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    return {
      hasPassword: user.passwordHash !== null,
      identities: user.identities.map((identity) => ({
        provider: identity.provider,
        email: identity.email,
        createdAt: identity.createdAt.toISOString(),
      })),
    };
  }

  /**
   * @description Removes the Google link. Refused while it is the only way in (no password), so nobody locks
   * themselves out.
   * @throws AppException AUTH_OAUTH_UNLINK_NOT_ALLOWED.
   */
  async unlink(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    if (user.passwordHash === null) throw new AppException(ErrorCode.AUTH_OAUTH_UNLINK_NOT_ALLOWED);
    await this.prisma.userIdentity.deleteMany({ where: { userId, provider: IdentityProvider.GOOGLE } });
  }

  /**
   * @description Sign in or sign up:
   * - a linked Google account → its user;
   * - otherwise an account with the same (Google-verified) email → link it. If that account never verified its
   *   email, whoever set its password didn't prove they own the address: the password is removed and its
   *   sessions revoked (account pre-hijacking);
   * - otherwise a new USER account, email already verified, straight to onboarding.
   */
  private async signIn(flow: OAuthFlow, identity: OAuthIdentity, client: ClientInfo): Promise<OAuthOutcome> {
    const linked = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: { provider: IdentityProvider.GOOGLE, providerUserId: identity.subject },
      },
      include: { user: true },
    });
    let user = linked?.user ?? (await this.prisma.user.findUnique({ where: { email: identity.email } }));

    if (user && !canUseSignInProviders(user)) throw new AppException(ErrorCode.AUTH_OAUTH_NOT_ALLOWED);
    if (user && user.status !== 'ACTIVE') throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            email: identity.email,
            passwordHash: null,
            fullName: displayName(identity),
            locale: flow.locale,
            emailVerifiedAt: new Date(),
            identities: { create: this.identityRow(identity) },
          },
        });
        await this.auth.sendWelcomeEmail(user);
      } catch (error) {
        // The same first sign-in finishing twice at once (a double click): the other request created the account
        // with this Google identity; sign in to it.
        if (!isUniqueViolation(error)) throw error;
        user = await this.prisma.user.findUniqueOrThrow({ where: { email: identity.email } });
      }
    } else if (!linked) {
      user = await this.linkByEmail(user, identity);
    }

    user = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await this.auth.startSession(user, client);
    const home = session.user.onboardingCompleted ? '/dashboard' : '/onboarding';
    const target = session.user.onboardingCompleted ? safeRedirectPath(flow.next, home) : home;
    return { session, redirectTo: this.webUrl(flow.locale, target) };
  }

  private async linkByEmail(user: User, identity: OAuthIdentity): Promise<User> {
    try {
      return await this.linkByEmailOnce(user, identity);
    } catch (error) {
      // Linked by a simultaneous request for the same sign-in: nothing left to do.
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    }
  }

  private async linkByEmailOnce(user: User, identity: OAuthIdentity): Promise<User> {
    if (user.emailVerifiedAt) {
      await this.prisma.userIdentity.create({ data: { ...this.identityRow(identity), userId: user.id } });
      await this.notifyLinked(user);
      return user;
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.userIdentity.create({ data: { ...this.identityRow(identity), userId: user.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: null, emailVerifiedAt: new Date() },
      }),
    ]);
    await this.tokens.revokeAllForUser(user.id);
    return updated;
  }

  /** Links Google to the signed-in user who started the flow (settings page). */
  private async link(flow: OAuthFlow, identity: OAuthIdentity): Promise<OAuthOutcome> {
    const user = flow.userId ? await this.prisma.user.findUnique({ where: { id: flow.userId } }) : null;
    if (!user) throw new AppException(ErrorCode.AUTH_OAUTH_FAILED);
    if (!canUseSignInProviders(user)) throw new AppException(ErrorCode.AUTH_OAUTH_NOT_ALLOWED);

    const existing = await this.prisma.userIdentity.findFirst({
      where: {
        provider: IdentityProvider.GOOGLE,
        OR: [{ providerUserId: identity.subject }, { userId: user.id }],
      },
    });
    if (existing && !(existing.userId === user.id && existing.providerUserId === identity.subject)) {
      // That Google account belongs to someone else, or this user already linked a different one.
      throw new AppException(ErrorCode.AUTH_OAUTH_ALREADY_LINKED);
    }
    if (!existing) {
      await this.prisma.userIdentity.create({ data: { ...this.identityRow(identity), userId: user.id } });
      await this.notifyLinked(user);
    }
    return { redirectTo: this.webUrl(flow.locale, '/settings', { linked: 'google' }) };
  }

  /**
   * @description Deletes the signed-in account after a fresh Google sign-in with the account linked to it — the
   * confirmation for users without a password.
   * @throws AppException AUTH_OAUTH_ACCOUNT_MISMATCH (another Google account), AUTH_ACCOUNT_DELETE_NOT_ALLOWED.
   */
  private async confirmDelete(flow: OAuthFlow, identity: OAuthIdentity): Promise<OAuthOutcome> {
    const linked = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: { provider: IdentityProvider.GOOGLE, providerUserId: identity.subject },
      },
    });
    if (!flow.userId || linked?.userId !== flow.userId) {
      throw new AppException(ErrorCode.AUTH_OAUTH_ACCOUNT_MISMATCH);
    }
    await this.account.purge(flow.userId);
    return { signOut: true, redirectTo: this.webUrl(flow.locale, '/login', { deleted: '1' }) };
  }

  private async notifyLinked(user: User): Promise<void> {
    await this.mail.send({
      template: 'google-linked',
      to: user.email,
      locale: user.locale,
      fullName: user.fullName,
      link: this.webUrl(user.locale, '/settings'),
    });
  }

  private identityRow(identity: OAuthIdentity) {
    return { provider: IdentityProvider.GOOGLE, providerUserId: identity.subject, email: identity.email };
  }

  /** The flow cookie, if it is ours, unexpired and unchanged. */
  private async readFlow(token: string | undefined): Promise<OAuthFlow | null> {
    if (!token) return null;
    try {
      return await this.jwt.verifyAsync<OAuthFlow>(token, { audience: FLOW_AUDIENCE });
    } catch {
      return null;
    }
  }

  private webUrl(locale: Locale, path: string, params: Record<string, string> = {}): string {
    const url = new URL(`/${locale}${path}`, this.webOrigin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
}

/** Google's display name, or the part of the email before `@` when the account has none. */
function displayName(identity: OAuthIdentity): string {
  const name = identity.name?.trim();
  return (name && name.length >= 2 ? name : identity.email.split('@')[0]!).slice(0, 100);
}
