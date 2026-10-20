'use client';

import type { AdminUsersQueryInput, Locale, UpdateIndustryInput, UserStatus } from '@offerleap/shared';
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

/** Changes one user (status, AI quota): the detail is replaced and lists refreshed. */
function useUserUpdate<TVariables>(
  id: string,
  update: (variables: TVariables) => ReturnType<typeof adminApi.user>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: update,
    onSuccess: (user) => {
      queryClient.setQueryData([...usersKey, 'detail', id], user);
      void queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });
}

export const useSetUserStatus = (id: string) =>
  useUserUpdate(id, (status: UserStatus) => adminApi.setStatus(id, status));
export const useSetAiQuota = (id: string) =>
  useUserUpdate(id, (quota: number | null) => adminApi.setAiQuota(id, quota));

export function useAiUsage(days: number) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', days],
    queryFn: ({ signal }) => adminApi.aiUsage(days, signal),
    placeholderData: keepPreviousData,
  });
}

const industriesKey = ['admin', 'industries'] as const;

export function useAdminIndustries() {
  return useQuery({ queryKey: industriesKey, queryFn: ({ signal }) => adminApi.industries(signal) });
}

/** Every change refreshes the list and the public taxonomy used by the forms. */
function useIndustryAction<TVariables, TResult>(action: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: industriesKey });
      void queryClient.invalidateQueries({ queryKey: ['taxonomies'] });
    },
  });
}

export const useCreateIndustry = () => useIndustryAction(adminApi.createIndustry);
export const useUpdateIndustry = () =>
  useIndustryAction(({ code, ...body }: UpdateIndustryInput & { code: string }) =>
    adminApi.updateIndustry(code, body),
  );
export const useRemoveIndustry = () => useIndustryAction(adminApi.removeIndustry);

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
