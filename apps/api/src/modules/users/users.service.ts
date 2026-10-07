import { Injectable } from '@nestjs/common';
import type { AuthUser, Locale } from '@offerleap/shared';

import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * @description Maps a database row to the public `AuthUser` shape (no password hash, no internal fields).
 * @param user - User row.
 * @returns The object sent to clients.
 */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    adminLevel: user.adminLevel,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    onboardingCompleted: user.onboardingCompletedAt !== null,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Emails are stored lower-cased (the shared schema normalises input), so lookups are exact. */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  createUser(data: { email: string; passwordHash: string; fullName: string; locale: Locale }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
