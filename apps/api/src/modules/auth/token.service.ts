import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload, ClientInfo } from '../../common/http/request';
import { generateOpaqueToken, hashToken } from '../../common/security/hashing';
import type { Env } from '../../config/env.schema';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionTokens } from './auth.cookies';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Two tabs refreshing at the same moment both send the same refresh cookie; one wins, the other sees a token
 * revoked a moment ago. Within this window that is treated as a race, not theft.
 */
const REUSE_GRACE_MS = 15_000;

/**
 * Issues short-lived access tokens (JWT, stateless) and long-lived refresh tokens (opaque, stored hashed,
 * rotated on every use, with reuse detection).
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL', { infer: true });
    this.refreshTtlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  /**
   * @description Starts a new session (login, email verification, password change).
   * @param user - Authenticated user.
   * @param client - User agent / IP stored with the session.
   * @returns Access + refresh tokens and their expiry dates.
   */
  async createSession(user: User, client: ClientInfo): Promise<SessionTokens> {
    return this.issue(user, randomUUID(), client);
  }

  /**
   * @description Exchanges a refresh token for a new pair (rotation). The old token becomes unusable.
   * @param rawToken - Refresh token from the cookie.
   * @param client - User agent / IP for the new token row.
   * @returns The user and the new tokens.
   * @throws AppException AUTH_TOKEN_INVALID (unknown or reused: the whole session is revoked), AUTH_TOKEN_EXPIRED,
   *   AUTH_ACCOUNT_LOCKED, or AUTH_REFRESH_RACE (another request rotated it a moment ago; retry).
   */
  async rotate(rawToken: string, client: ClientInfo): Promise<{ user: User; tokens: SessionTokens }> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!stored) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);

    if (stored.revokedAt) {
      // Just rotated by another request of the same browser (two tabs waking up together): not theft. That request
      // set fresh cookies; this one must leave them alone and retry with them.
      // (Rotated, not revoked: a sign-out or password change revokes without a replacement.)
      const recent = now.getTime() - stored.revokedAt.getTime() <= REUSE_GRACE_MS;
      if (recent && stored.replacedById) {
        throw new AppException(ErrorCode.AUTH_REFRESH_RACE, { message: 'Refresh token was just rotated' });
      }
      // Reused long after its rotation: someone else has a copy (theft) — end the whole session. Within the grace
      // window it was revoked on purpose (sign-out, password change) or is mid-rotation: just refuse it.
      if (!recent) await this.revokeFamily(stored.familyId);
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, { message: 'Refresh token already used' });
    }
    if (stored.expiresAt <= now) throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED);
    if (stored.user.status !== 'ACTIVE') {
      await this.revokeFamily(stored.familyId);
      throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    }

    // Claim the token atomically: if a concurrent request already rotated it, count = 0.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (claimed.count === 0) {
      throw new AppException(ErrorCode.AUTH_REFRESH_RACE, { message: 'Refresh token was just rotated' });
    }

    const tokens = await this.issue(stored.user, stored.familyId, client, stored.id);
    return { user: stored.user, tokens };
  }

  /**
   * @description Ends the session a refresh token belongs to (logout). Unknown tokens are ignored.
   * @param rawToken - Refresh token from the cookie.
   */
  async revokeByToken(rawToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  /**
   * @description Signs the user out everywhere (password change / reset).
   * @param userId - User whose sessions end.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(
    user: User,
    familyId: string,
    client: ClientInfo,
    previousId?: string,
  ): Promise<SessionTokens> {
    const now = Date.now();
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, adminLevel: user.adminLevel };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.accessTtlSeconds });
    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = new Date(now + this.refreshTtlMs);

    const created = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: client.userAgent,
        ipAddress: client.ipAddress,
      },
    });
    if (previousId) {
      await this.prisma.refreshToken.update({
        where: { id: previousId },
        data: { replacedById: created.id },
      });
    }

    return {
      accessToken,
      accessTokenExpiresAt: new Date(now + this.accessTtlSeconds * 1000),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
