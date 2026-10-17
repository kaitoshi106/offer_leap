import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, Role } from '@offerleap/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from '../decorators/auth.decorators';
import { AppException } from '../errors/app.exception';
import type { AppRequest } from '../http/request';

/**
 * Global guard running after authentication: a USER who hasn't finished onboarding may only call routes marked
 * `@AllowIncompleteProfile()`. Admins never go through onboarding. Reads the database instead of a token claim
 * so finishing onboarding takes effect immediately.
 */
@Injectable()
export class ProfileCompletedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<AppRequest>().user;
    // Public routes have no user; admins are exempt.
    if (!user || user.role !== Role.USER) return true;

    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_INCOMPLETE_PROFILE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const record = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { onboardingCompletedAt: true },
    });
    if (!record?.onboardingCompletedAt) throw new AppException(ErrorCode.ONBOARDING_REQUIRED);
    return true;
  }
}
