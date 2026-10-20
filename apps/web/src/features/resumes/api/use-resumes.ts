'use client';

import { type OnboardingState, RESUME_FINAL_STATUSES, type ResumeSummary } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingKey } from '@/features/onboarding/api/use-onboarding';

import { resumesApi } from './resumes-api';

/** How often to ask whether the AI has finished. */
const POLL_INTERVAL_MS = 1_500;

export const isResumeFinal = (resume: ResumeSummary) => RESUME_FINAL_STATUSES.includes(resume.status);

export const resumesKey = ['resumes'] as const;

/** The user's CVs, newest first. */
export function useResumes() {
  return useQuery({ queryKey: resumesKey, queryFn: ({ signal }) => resumesApi.list(signal) });
}

/** Uploads a CV; the new (pending) CV becomes the onboarding state's `resume` and joins the CV list. */
export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.upload,
    onSuccess: (resume) => {
      queryClient.setQueryData<OnboardingState>(onboardingKey, (state) => state && { ...state, resume });
      queryClient.setQueryData<ResumeSummary[]>(resumesKey, (resumes) => resumes && [resume, ...resumes]);
    },
  });
}

/**
 * @description Polls a CV while the AI is reading it. Once it is COMPLETED or FAILED the result is written into
 * the onboarding state, which turns `enabled` off and stops the polling, and the draft is refetched because the
 * API has filled it with the values read from the CV.
 * @param resume - Latest CV from the onboarding state (null when none was uploaded).
 */
export function useResumePolling(resume: ResumeSummary | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...resumesKey, resume?.id],
    queryFn: async ({ signal }) => {
      const latest = await resumesApi.get(resume!.id, signal);
      if (isResumeFinal(latest)) {
        queryClient.setQueryData<OnboardingState>(
          onboardingKey,
          (state) => state && { ...state, resume: latest },
        );
        if (latest.status === 'COMPLETED') await queryClient.invalidateQueries({ queryKey: onboardingKey });
      }
      return latest;
    },
    enabled: resume !== null && !isResumeFinal(resume),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
