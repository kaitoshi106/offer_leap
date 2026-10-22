import { describe, expect, it } from 'vitest';

import { decideRouteAccess } from './route-access';

describe('decideRouteAccess', () => {
  it('sends signed-out visitors of protected pages to login, remembering where they were going', () => {
    expect(decideRouteAccess('/dashboard', '', false)).toEqual({ redirect: '/login?next=%2Fdashboard' });
    expect(decideRouteAccess('/admin/users', '?page=2', false)).toEqual({
      redirect: '/login?next=%2Fadmin%2Fusers%3Fpage%3D2',
    });
  });

  it('sends signed-in users away from guest-only pages', () => {
    expect(decideRouteAccess('/login', '', true)).toEqual({ redirect: '/dashboard' });
    expect(decideRouteAccess('/register', '', true)).toEqual({ redirect: '/dashboard' });
  });

  it('lets everything else through', () => {
    expect(decideRouteAccess('/', '', false)).toBeNull();
    expect(decideRouteAccess('/dashboard', '', true)).toBeNull();
    expect(decideRouteAccess('/verify-email', '?token=x', true)).toBeNull();
    expect(decideRouteAccess('/dashboards-are-not-dashboard', '', false)).toBeNull();
  });

  it('keeps finished accounts out of onboarding and unfinished ones in it, before anything renders', () => {
    expect(decideRouteAccess('/onboarding', '', true, 'done')).toEqual({ redirect: '/dashboard' });
    expect(decideRouteAccess('/dashboard', '', true, 'pending')).toEqual({ redirect: '/onboarding' });
    expect(decideRouteAccess('/settings', '', true, 'pending')).toEqual({ redirect: '/onboarding' });
    expect(decideRouteAccess('/onboarding', '', true, 'pending')).toBeNull();
    expect(decideRouteAccess('/dashboard', '', true, 'done')).toBeNull();
    // Public pages are not affected.
    expect(decideRouteAccess('/', '', true, 'pending')).toBeNull();
  });

  it('decides nothing about onboarding without the flag (sessions from before it existed) or a session', () => {
    expect(decideRouteAccess('/onboarding', '', true)).toBeNull();
    expect(decideRouteAccess('/dashboard', '', true)).toBeNull();
    expect(decideRouteAccess('/onboarding', '', false, 'done')).toEqual({
      redirect: '/login?next=%2Fonboarding',
    });
  });
});
