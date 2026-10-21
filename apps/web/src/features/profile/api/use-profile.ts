'use client';

import type { AuthUser, ProfileValues } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserKey } from '@/features/auth/api/use-auth';

import { profileApi } from './profile-api';

const profileKey = ['profile'] as const;

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: ({ signal }) => profileApi.get(signal) });
}

/** Saves one section; the response replaces the cached profile, and the account name follows the profile name. */
export function useSaveProfileSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.saveSection,
    onSuccess: (profile) => {
      queryClient.setQueryData<ProfileValues>(profileKey, profile);
      queryClient.setQueryData<AuthUser | null>(currentUserKey, (user) =>
        user ? { ...user, fullName: profile.fullName } : user,
      );
    },
  });
}
