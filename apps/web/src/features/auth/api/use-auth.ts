'use client';

import type { AuthUser } from '@offerleap/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';
import { useAuthRedirect } from '@/lib/auth-redirect';

import { authApi } from './auth-api';

export const currentUserKey = ['auth', 'me'] as const;

/**
 * @description The signed-in user, or `null` when there is no valid session (after one refresh attempt).
 * @returns React Query result.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: async ({ signal }): Promise<AuthUser | null> => {
      try {
        return await authApi.me(signal);
      } catch (error) {
        if (isApiError(error) && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * @description Signs out and reloads on the sign-in page, whatever the API answered. The full page load drops
 * every cached query and in-memory state of the previous user, so no page reacts to a half-cleared cache (e.g.
 * redirecting to `/login?next=…` while the sign-out is still in flight).
 * @returns React Query mutation; call `mutate()`.
 */
export function useLogout() {
  const redirect = useAuthRedirect();
  return useMutation({ mutationFn: authApi.logout, onSettled: () => redirect('/login') });
}
