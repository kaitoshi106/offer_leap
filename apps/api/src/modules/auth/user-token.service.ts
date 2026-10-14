import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { generateOpaqueToken, hashToken } from '../../common/security/hashing';
import type { UserTokenType } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const USER_TOKEN_TTL_MS: Record<UserTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

export interface ValidUserToken {
  id: string;
  userId: string;
}

/** Single-use tokens sent by email. Only the hash is stored; issuing a new one invalidates older ones. */
@Injectable()
export class UserTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @description Creates a token of `type` for a user, invalidating earlier unused tokens of the same type.
   * @param userId - Owner.
   * @param type - Verification or password reset.
   * @returns The raw token to put in the email link.
   */
  async issue(userId: string, type: UserTokenType): Promise<string> {
    const token = generateOpaqueToken();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + USER_TOKEN_TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /**
   * @description Checks a token without using it up, so a request that fails for another reason (e.g. the new
   * password is rejected) leaves the link usable. Call {@link claim} once the action can go ahead.
   * @param rawToken - Token from the link.
   * @param type - Expected type (a reset token can't verify an email and vice versa).
   * @returns The token row id and its owner.
   * @throws AppException AUTH_TOKEN_INVALID (unknown/used/wrong type) or AUTH_TOKEN_EXPIRED.
   */
  async verify(rawToken: string, type: UserTokenType): Promise<ValidUserToken> {
    const stored = await this.prisma.userToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!stored || stored.type !== type || stored.usedAt)
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    if (stored.expiresAt <= new Date()) throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED);
    return { id: stored.id, userId: stored.userId };
  }

  /**
   * @description Marks a verified token as used. Atomic: if two requests race, only one succeeds.
   * @param tokenId - Id returned by {@link verify}.
   * @throws AppException AUTH_TOKEN_INVALID when it was used in the meantime.
   */
  async claim(tokenId: string): Promise<void> {
    const claimed = await this.prisma.userToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
  }

  /**
   * @description Verifies and burns a token in one step.
   * @param rawToken - Token from the link.
   * @param type - Expected type.
   * @returns The owner's id.
   */
  async consume(rawToken: string, type: UserTokenType): Promise<string> {
    const token = await this.verify(rawToken, type);
    await this.claim(token.id);
    return token.userId;
  }
}
