import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.cookies';
import { UserThrottlerGuard } from './user-throttler.guard';

const jwt = new JwtService({ secret: 'test-secret' });

/** Exposes the protected `getTracker` for the tests. */
class TestGuard extends UserThrottlerGuard {
  tracker(request: object) {
    return this.getTracker(request as never);
  }
}

const guard = new TestGuard({ throttlers: [] }, new ThrottlerStorageService(), new Reflector(), jwt);
const request = (cookie?: string, authorization?: string) => ({
  ip: '203.0.113.7',
  cookies: cookie ? { [ACCESS_TOKEN_COOKIE]: cookie } : {},
  headers: authorization ? { authorization } : {},
});

describe('UserThrottlerGuard', () => {
  it('counts signed-in requests per user, wherever they come from', async () => {
    const token = await jwt.signAsync({ sub: 'u1', role: 'USER', adminLevel: null });
    expect(await guard.tracker(request(token))).toBe('user:u1');
    expect(await guard.tracker(request(undefined, `Bearer ${token}`))).toBe('user:u1');
  });

  it('counts anonymous requests per IP', async () => {
    expect(await guard.tracker(request())).toBe('203.0.113.7');
  });

  it('does not trust tokens it cannot verify, so a forged user id cannot dodge the limit', async () => {
    const forged = await new JwtService({ secret: 'other' }).signAsync({ sub: 'victim', role: 'USER' });
    const expired = await jwt.signAsync({ sub: 'u1', role: 'USER' }, { expiresIn: -10 });
    // Same key, but an OAuth flow token (it has an audience), not an access token.
    const flow = await jwt.signAsync({ sub: 'u1' }, { audience: 'oauth' });
    for (const token of [forged, expired, flow, 'not-a-jwt']) {
      expect(await guard.tracker(request(token))).toBe('203.0.113.7');
    }
  });
});
