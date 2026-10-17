'use client';

import type { AuthUser, OnboardingState, SaveOnboardingStepInput } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserKey } from '@/features/auth/api/use-auth';

import { onboardingApi, taxonomyApi } from './onboarding-api';

export const onboardingKey = ['onboarding'] as const;

/** The saved draft and the step to resume at. */
export function useOnboardingState() {
  return useQuery({ queryKey: onboardingKey, queryFn: ({ signal }) => onboardingApi.state(signal) });
}

/** Industries and provinces. Reference data: fetched once per session. */
export function useTaxonomies() {
  const industries = useQuery({
    queryKey: ['taxonomies', 'industries'],
    queryFn: ({ signal }) => taxonomyApi.industries(signal),
    staleTime: Infinity,
  });
  const provinces = useQuery({
    queryKey: ['taxonomies', 'provinces'],
    queryFn: ({ signal }) => taxonomyApi.provinces(signal),
    staleTime: Infinity,
  });
  return { industries, provinces };
}

/** Saves a step; the response (new draft + resume point) replaces the cached state. */
export function useSaveOnboardingStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveOnboardingStepInput) => onboardingApi.saveStep(body),
    onSuccess: (state) => queryClient.setQueryData<OnboardingState>(onboardingKey, state),
  });
}

/** Finishes onboarding and marks the cached user as onboarded so guards let them through. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingApi.complete,
    onSuccess: (state) => {
      queryClient.setQueryData<OnboardingState>(onboardingKey, state);
      queryClient.setQueryData<AuthUser | null>(currentUserKey, (user) =>
        user ? { ...user, onboardingCompleted: true } : user,
      );
    },
  });
}
