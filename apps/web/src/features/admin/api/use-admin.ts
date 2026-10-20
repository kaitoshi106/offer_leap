'use client';

import type { AdminUsersQueryInput, Locale, UserStatus } from '@offerleap/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from './admin-api';

const usersKey = ['admin', 'users'] as const;
const invitationsKey = ['admin', 'invitations'] as const;

/** One page of users. The previous page stays on screen while the next loads (no flicker when paging). */
export function useAdminUsers(query: AdminUsersQueryInput) {
  return useQuery({
    queryKey: [...usersKey, query],
    queryFn: ({ signal }) => adminApi.users(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: [...usersKey, 'detail', id],
    queryFn: ({ signal }) => adminApi.user(id, signal),
  });
}

export function useSetUserStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: UserStatus) => adminApi.setStatus(id, status),
    onSuccess: (user) => {
      queryClient.setQueryData([...usersKey, 'detail', id], user);
      void queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });
}

export function useInvitations() {
  return useQuery({ queryKey: invitationsKey, queryFn: ({ signal }) => adminApi.invitations(signal) });
}

/** Invite / resend / revoke all refresh the invitation list. */
function useInvitationAction<TVariables, TResult>(action: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey }),
  });
}

export const useInviteAdmin = () => useInvitationAction(adminApi.invite);
export const useResendInvitation = () =>
  useInvitationAction(({ id, locale }: { id: string; locale: Locale }) => adminApi.resend(id, locale));
export const useRevokeInvitation = () => useInvitationAction(adminApi.revoke);
