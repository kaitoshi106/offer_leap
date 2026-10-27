import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

import type { AppRequest } from '../http/request';
import { extractAccessToken, verifyAccessToken } from './jwt-auth.guard';

/**
 * Rate limits per signed-in user, and per IP for everyone else (sign-in, sign-up, password reset). Per IP alone, a
 * whole office behind one address would share a single allowance, and one user could take another's.
 * It runs before `JwtAuthGuard`, so it checks the token itself: an unverified `sub` could be forged to dodge the
 * limit. Invalid or expired tokens count against the IP (the request is refused right after anyway).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    super(options, storage, reflector);
  }

  /**
   * @description Who a request counts against: `user:<id>` with a valid access token, else the client IP.
   * @param request - Incoming request.
   */
  protected override async getTracker(request: AppRequest): Promise<string> {
    const token = extractAccessToken(request);
    if (token) {
      const user = await verifyAccessToken(this.jwt, token).catch(() => null);
      if (user) return `user:${user.sub}`;
    }
    return super.getTracker(request);
  }
}
