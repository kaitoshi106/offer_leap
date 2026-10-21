import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@offerleap/shared';

import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.cookies';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { AppException } from '../errors/app.exception';
import type { AccessTokenPayload, AppRequest } from '../http/request';

/**
 * Global guard: every route needs a valid access token unless marked `@Public()`. The token is read from the
 * httpOnly cookie (browser) or an `Authorization: Bearer` header (scripts, tests).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = extractAccessToken(request);
    if (!token) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload & { aud?: unknown }>(token);
      // The same key signs short-lived tokens with an audience (the OAuth flow cookie); only access tokens,
      // which have none, open the API.
      if (payload.aud !== undefined || typeof payload.sub !== 'string')
        throw new Error('Not an access token');
      request.user = { sub: payload.sub, role: payload.role, adminLevel: payload.adminLevel };
      return true;
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(expired ? ErrorCode.AUTH_TOKEN_EXPIRED : ErrorCode.AUTH_UNAUTHENTICATED, {
        cause: error,
      });
    }
  }
}

/**
 * @description Reads the access token from the cookie first, then the Authorization header.
 * @param request - Incoming request (cookies parsed by `cookie-parser`).
 * @returns The raw JWT or `undefined`.
 */
export function extractAccessToken(request: AppRequest): string | undefined {
  const fromCookie: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;

  const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
