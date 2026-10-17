import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@offerleap/shared';

import type { AccessTokenPayload, AppRequest } from '../http/request';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const ROOT_ONLY_KEY = 'auth:rootOnly';
export const ALLOW_INCOMPLETE_PROFILE_KEY = 'auth:allowIncompleteProfile';

/** Opens a route (or controller) to anonymous requests. Everything else requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Restricts a route to the root admin (e.g. inviting admins). */
export const RootOnly = () => SetMetadata(ROOT_ONLY_KEY, true);

/**
 * Lets signed-in users who haven't finished onboarding call a route (auth, onboarding, taxonomies). Every other
 * authenticated route requires a completed profile for USER accounts.
 */
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);

/**
 * Injects the authenticated user's token claims into a handler parameter: `me(@CurrentUser() user)`.
 * Only valid on non-public routes, where `JwtAuthGuard` has already set `request.user`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    const user = context.switchToHttp().getRequest<AppRequest>().user;
    if (!user) throw new Error('@CurrentUser() used on a route without authentication');
    return user;
  },
);
