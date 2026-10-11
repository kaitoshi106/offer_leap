'use client';

import type { AuthUser } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';

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
 * @description Signs out and forgets every cached query (the data belonged to the previous user).
 * @returns React Query mutation.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // removeQueries, not clear(): clear() also drops the mutation cache, which can swallow the caller's
      // `mutate(…, { onSettled })` callback (e.g. the redirect to /login).
      queryClient.removeQueries();
      queryClient.setQueryData(currentUserKey, null);
    },
  });
}
