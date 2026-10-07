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
   * @description Validates and burns a token.
   * @param rawToken - Token from the link.
   * @param type - Expected type (a reset token can't verify an email and vice versa).
   * @returns The owner's id.
   * @throws AppException AUTH_TOKEN_INVALID (unknown/used/wrong type) or AUTH_TOKEN_EXPIRED.
   */
  async consume(rawToken: string, type: UserTokenType): Promise<string> {
    const now = new Date();
    const stored = await this.prisma.userToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!stored || stored.type !== type || stored.usedAt)
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    if (stored.expiresAt <= now) throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED);

    const claimed = await this.prisma.userToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    return stored.userId;
  }
}
