import { Injectable } from '@nestjs/common';
import {
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUsersQuery,
  canManageAccount,
  ErrorCode,
  type Paginated,
  type UserStatus,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload } from '../../common/http/request';
import type { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { TokenService } from '../auth/token.service';

function toListItem(user: User): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    adminLevel: user.adminLevel,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    onboardingCompleted: user.onboardingCompletedAt !== null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const actorIdentity = (actor: AccessTokenPayload) => ({
  id: actor.sub,
  role: actor.role,
  adminLevel: actor.adminLevel,
});

/** User management for admins: search, inspect, disable/enable. Read-only on profile data and documents. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly quota: AiQuotaService,
  ) {}

  /** One page of accounts matching the filters, newest first. `q` searches email and name, ignoring case. */
  async list(query: AdminUsersQuery): Promise<Paginated<AdminUserListItem>> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      ...(query.q && {
        OR: [
          { email: { contains: query.q, mode: 'insensitive' } },
          { fullName: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: users.map(toListItem), total, page: query.page, pageSize: query.pageSize };
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async detail(actor: AccessTokenPayload, id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        _count: { select: { resumes: true, analyses: true, applications: true, interviews: true } },
      },
    });
    if (!user) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'User not found' });
    const quota = await this.quota.status(user.id);

    return {
      ...toListItem(user),
      profile: user.profile && {
        jobTitle: user.profile.jobTitle,
        level: user.profile.level,
        yearsOfExperience: user.profile.yearsOfExperience,
        provinceCode: user.profile.provinceCode,
        industryCode: user.profile.industryCode,
      },
      activity: user._count,
      ai: { callsInWindow: quota.used, limit: quota.limit, override: user.aiDailyQuota },
      manageable: canManageAccount(actorIdentity(actor), user),
    };
  }

  /**
   * @description Disables or re-enables an account. Disabling also ends every session of that account (refresh
   * tokens revoked), so the user is signed out within one access-token lifetime at most.
   * @throws AppException COMMON_NOT_FOUND, or ADMIN_ACTION_NOT_ALLOWED (self, root, or another admin for a
   *   general admin — see `canManageAccount`).
   */
  async setStatus(actor: AccessTokenPayload, id: string, status: UserStatus): Promise<AdminUserDetail> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'User not found' });
    if (!canManageAccount(actorIdentity(actor), target)) {
      throw new AppException(ErrorCode.ADMIN_ACTION_NOT_ALLOWED);
    }

    await this.prisma.user.update({ where: { id }, data: { status } });
    if (status === 'DISABLED') await this.tokens.revokeAllForUser(id);
    return this.detail(actor, id);
  }

  /**
   * @description Sets a user's own AI limit (`null` = back to AI_DAILY_QUOTA). Same permission rule as status.
   * @throws AppException COMMON_NOT_FOUND / ADMIN_ACTION_NOT_ALLOWED.
   */
  async setAiQuota(
    actor: AccessTokenPayload,
    id: string,
    aiDailyQuota: number | null,
  ): Promise<AdminUserDetail> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'User not found' });
    if (!canManageAccount(actorIdentity(actor), target)) {
      throw new AppException(ErrorCode.ADMIN_ACTION_NOT_ALLOWED);
    }
    await this.prisma.user.update({ where: { id }, data: { aiDailyQuota } });
    return this.detail(actor, id);
  }
}
