import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, isRootAdmin, type Role } from '@offerleap/shared';

import { ROLES_KEY, ROOT_ONLY_KEY } from '../decorators/auth.decorators';
import { AppException } from '../errors/app.exception';
import type { AppRequest } from '../http/request';

/**
 * Global guard running after `JwtAuthGuard`: enforces `@Roles(...)` and `@RootOnly()`. Routes without either
 * decorator are open to any authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const rootOnly = this.reflector.getAllAndOverride<boolean | undefined>(ROOT_ONLY_KEY, targets);
    if (!roles?.length && !rootOnly) return true;

    const user = context.switchToHttp().getRequest<AppRequest>().user;
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);

    const roleAllowed = !roles?.length || roles.includes(user.role);
    const rootAllowed = !rootOnly || isRootAdmin(user);
    if (!roleAllowed || !rootAllowed) throw new AppException(ErrorCode.AUTH_FORBIDDEN);
    return true;
  }
}
