import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AuthUser,
  canManageOwnPassword,
  type ChangePasswordInput,
  ErrorCode,
  type Locale,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  ValidationRule,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { ClientInfo } from '../../common/http/request';
import { hashPassword, verifyPassword } from '../../common/security/hashing';
import type { Env } from '../../config/env.schema';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { toAuthUser, UsersService } from '../users/users.service';
import type { SessionTokens } from './auth.cookies';
import { TokenService } from './token.service';
import { UserTokenService } from './user-token.service';

export interface SessionResult {
  user: AuthUser;
  tokens: SessionTokens;
}

/**
 * Hash of a random password, verified when the email is unknown so a login for a non-existent account takes
 * as long as a wrong password (no timing oracle for "does this email exist?").
 */
const DUMMY_HASH_PROMISE = hashPassword('offerleap-timing-equaliser-1');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly userTokens: UserTokenService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  /**
   * @description Creates an unverified USER account and emails a verification link. No session is created
   * until the email is verified.
   * @param input - Validated registration data.
   * @param fallbackLocale - Locale from the request when the body has none.
   * @returns The new account's email.
   * @throws AppException AUTH_EMAIL_TAKEN.
   */
  async register(input: RegisterInput, fallbackLocale: Locale): Promise<{ email: string }> {
    if (await this.users.findByEmail(input.email)) throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);

    const user = await this.users.createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      locale: input.locale ?? fallbackLocale,
    });
    await this.sendVerificationEmail(user);
    return { email: user.email };
  }

  /**
   * @description Marks the email verified and signs the user in (the link proves inbox ownership).
   * @param token - Token from the email link.
   * @param client - Session metadata.
   * @returns User and session tokens.
   */
  async verifyEmail(token: string, client: ClientInfo): Promise<SessionResult> {
    const userId = await this.userTokens.consume(token, 'EMAIL_VERIFICATION');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    return this.startSession(user, client);
  }

  /**
   * @description Sends a new verification link. Silent for unknown emails (no account enumeration).
   * @param email - Account email.
   * @throws AppException AUTH_EMAIL_ALREADY_VERIFIED when the account is already verified.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    if (user.emailVerifiedAt) throw new AppException(ErrorCode.AUTH_EMAIL_ALREADY_VERIFIED);
    await this.sendVerificationEmail(user);
  }

  /**
   * @description Checks credentials and starts a session.
   * @param input - Email and password.
   * @param client - Session metadata.
   * @returns User and session tokens.
   * @throws AppException AUTH_INVALID_CREDENTIALS, AUTH_ACCOUNT_LOCKED or AUTH_EMAIL_NOT_VERIFIED.
   */
  async login(input: LoginInput, client: ClientInfo): Promise<SessionResult> {
    const user = await this.users.findByEmail(input.email);
    const passwordOk = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH_PROMISE), input.password);
    if (!user || !passwordOk) throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);

    // Checked only after the password, so these states don't leak for accounts the caller doesn't own.
    if (user.status !== 'ACTIVE') throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    if (!user.emailVerifiedAt) throw new AppException(ErrorCode.AUTH_EMAIL_NOT_VERIFIED);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.startSession(user, client);
  }

  /**
   * @description Rotates the refresh token and returns a fresh session.
   * @param refreshToken - Token from the refresh cookie.
   * @param client - Session metadata.
   */
  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<SessionResult> {
    if (!refreshToken) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    const { user, tokens } = await this.tokens.rotate(refreshToken, client);
    return { user: toAuthUser(user), tokens };
  }

  /**
   * @description Ends the current session. Always succeeds so a stale cookie can still be cleared.
   * @param refreshToken - Token from the refresh cookie, if any.
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revokeByToken(refreshToken);
  }

  /**
   * @description Returns the current user.
   * @param userId - Id from the access token.
   * @throws AppException AUTH_UNAUTHENTICATED if the account no longer exists.
   */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    return toAuthUser(user);
  }

  /**
   * @description Emails a reset link. Silent for unknown, unverified or root accounts (no enumeration, and
   * root credentials are managed through config only).
   * @param email - Account email.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.emailVerifiedAt || user.status !== 'ACTIVE' || !canManageOwnPassword(user)) return;

    const token = await this.userTokens.issue(user.id, 'PASSWORD_RESET');
    await this.mail.send({
      template: 'reset-password',
      to: user.email,
      locale: user.locale,
      fullName: user.fullName,
      link: this.webLink(user.locale, 'reset-password', token),
    });
  }

  /**
   * @description Sets a new password from a reset link and signs out every session. The new password must differ
   * from the current one (same rule as change-password); that check runs before the token is used up, so the
   * link keeps working after a rejected attempt.
   * @param input - Token and new password.
   * @throws AppException AUTH_TOKEN_INVALID/EXPIRED, AUTH_PASSWORD_CHANGE_NOT_ALLOWED (root) or
   *   COMMON_VALIDATION_FAILED (`sameAsCurrent` on `password`).
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const token = await this.userTokens.verify(input.token, 'PASSWORD_RESET');
    const user = await this.users.findById(token.userId);
    if (!user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    if (!canManageOwnPassword(user)) throw new AppException(ErrorCode.AUTH_PASSWORD_CHANGE_NOT_ALLOWED);
    if (await verifyPassword(user.passwordHash, input.password)) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'New password equals the current one',
        fieldErrors: [{ field: 'password', rule: ValidationRule.SAME_AS_CURRENT }],
      });
    }

    await this.userTokens.claim(token.id);
    await this.updatePassword(user.id, input.password);
    await this.tokens.revokeAllForUser(user.id);
  }

  /**
   * @description Changes the password of the signed-in user, ends all other sessions and starts a new one.
   * @param userId - Id from the access token.
   * @param input - Current and new password.
   * @param client - Session metadata.
   * @throws AppException AUTH_PASSWORD_CHANGE_NOT_ALLOWED (root) or AUTH_INVALID_CREDENTIALS (wrong current).
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    client: ClientInfo,
  ): Promise<SessionResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    if (!canManageOwnPassword(user)) throw new AppException(ErrorCode.AUTH_PASSWORD_CHANGE_NOT_ALLOWED);
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const updated = await this.updatePassword(user.id, input.newPassword);
    await this.tokens.revokeAllForUser(user.id);
    return this.startSession(updated, client);
  }

  private async startSession(user: User, client: ClientInfo): Promise<SessionResult> {
    return { user: toAuthUser(user), tokens: await this.tokens.createSession(user, client) };
  }

  private async updatePassword(userId: string, password: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
    });
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = await this.userTokens.issue(user.id, 'EMAIL_VERIFICATION');
    await this.mail.send({
      template: 'verify-email',
      to: user.email,
      locale: user.locale,
      fullName: user.fullName,
      link: this.webLink(user.locale, 'verify-email', token),
    });
    this.logger.debug(`Verification email queued for user ${user.id}`);
  }

  private webLink(locale: Locale, page: string, token: string): string {
    const url = new URL(`/${locale}/${page}`, this.webOrigin);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
