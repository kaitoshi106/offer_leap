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
});
