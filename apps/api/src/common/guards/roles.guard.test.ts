import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import { Roles, RootOnly } from '../decorators/auth.decorators';
import type { AccessTokenPayload } from '../http/request';
import { RolesGuard } from './roles.guard';

class TestController {
  open() {}
  @Roles('ADMIN')
  adminOnly() {}
  @RootOnly()
  rootOnly() {}
}

const USER: AccessTokenPayload = { sub: 'u', role: 'USER', adminLevel: null };
const GENERAL: AccessTokenPayload = { sub: 'g', role: 'ADMIN', adminLevel: 'GENERAL' };
const ROOT: AccessTokenPayload = { sub: 'r', role: 'ADMIN', adminLevel: 'ROOT' };

/**
 * @description Minimal ExecutionContext for a handler of TestController and a request user.
 */
function contextFor(handler: keyof TestController, user?: AccessTokenPayload): ExecutionContext {
  return {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets any authenticated user through undecorated routes', () => {
    expect(guard.canActivate(contextFor('open', USER))).toBe(true);
  });

  it('enforces @Roles', () => {
    expect(guard.canActivate(contextFor('adminOnly', GENERAL))).toBe(true);
    expect(() => guard.canActivate(contextFor('adminOnly', USER))).toThrow(
      expect.objectContaining({ code: ErrorCode.AUTH_FORBIDDEN }),
    );
  });

  it('enforces @RootOnly', () => {
    expect(guard.canActivate(contextFor('rootOnly', ROOT))).toBe(true);
    expect(() => guard.canActivate(contextFor('rootOnly', GENERAL))).toThrow(
      expect.objectContaining({ code: ErrorCode.AUTH_FORBIDDEN }),
    );
  });

  it('rejects decorated routes without a user', () => {
    expect(() => guard.canActivate(contextFor('adminOnly'))).toThrow(
      expect.objectContaining({ code: ErrorCode.AUTH_UNAUTHENTICATED }),
    );
  });
});
