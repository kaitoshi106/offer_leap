'use client';

import {
  type OnboardingState,
  RESUME_FINAL_STATUSES,
  type ResumeMimeType,
  type ResumeSummary,
} from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingKey } from '@/features/onboarding/api/use-onboarding';

import { resumesApi } from './resumes-api';

/** How often to ask whether the AI has finished. */
const POLL_INTERVAL_MS = 1_500;

export const isResumeFinal = (resume: ResumeSummary) => RESUME_FINAL_STATUSES.includes(resume.status);

const resumesKey = ['resumes'] as const;

/** The user's CV list query, also fetched on its own when an upload hits the CV limit. */
export const resumesQuery = {
  queryKey: resumesKey,
  queryFn: ({ signal }: { signal: AbortSignal }) => resumesApi.list(signal),
};

/** The user's CVs, newest first. Refreshes itself while the AI is still reading one. */
export function useResumes() {
  return useQuery({
    ...resumesQuery,
    refetchInterval: (query) => (query.state.data?.some((resume) => !isResumeFinal(resume)) ? 2_000 : false),
  });
}

/** Deletes a CV (and, on the API, the analyses made with it). */
export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resumesKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: ['analyses'] });
      // Its analyses go with it, and with them the scores shown on applications.
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/** What to upload; `replaceId` deletes that CV in the same step (see `resumesApi.upload`). */
export interface UploadResumeVariables {
  /** The file as it will be sent: photos already shrunk with `prepareResumeFile`. */
  file: File;
  replaceId?: string;
}

/**
 * @description Uploads a CV; it becomes the onboarding state's `resume` and goes to the top of the CV list. The
 * same file uploaded again comes back as the existing CV (`reused`), which moves up instead of appearing twice.
 * Pages use `useResumeUploader`, which shrinks photos first and offers to replace the oldest CV at the limit.
 */
export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, replaceId }: UploadResumeVariables) => resumesApi.upload(file, replaceId),
    onSuccess: ({ reused, ...resume }, variables) => {
      // A duplicate comes back as the existing CV and nothing is replaced.
      const replaceId = reused ? undefined : variables.replaceId;
      queryClient.setQueryData<OnboardingState>(onboardingKey, (state) => state && { ...state, resume });
      // During onboarding a CV read earlier puts its values back into the draft at once (no polling to wait for).
      if (reused && resume.status === 'COMPLETED')
        void queryClient.invalidateQueries({ queryKey: onboardingKey });
      queryClient.setQueryData<ResumeSummary[]>(
        resumesKey,
        (resumes) =>
          resumes && [
            // Keep the list's analysis count: the upload answer doesn't carry it.
            { ...resumes.find(({ id }) => id === resume.id), ...resume },
            ...resumes.filter(({ id }) => id !== resume.id && id !== replaceId),
          ],
      );
      if (replaceId) {
        // The replaced CV took its analyses with it, and with them the scores shown on applications.
        void queryClient.invalidateQueries({ queryKey: ['analyses'] });
        void queryClient.invalidateQueries({ queryKey: ['applications'] });
      }
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

/** DOCX can't be shown by browsers: it comes as HTML. PDFs and images come as the file itself. */
export type ResumeFileContent = { kind: 'html'; html: string } | { kind: 'file'; blob: Blob };

const DOCX: ResumeMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * @description Loads an uploaded CV to show it. A stored file never changes, so it is fetched once per CV.
 * @param resume - The CV to show, or null when none is open.
 */
export function useResumeFile(resume: Pick<ResumeSummary, 'id' | 'mimeType'> | null) {
  return useQuery({
    // Its own key root: invalidating `['resumes']` must not download every opened file again.
    queryKey: ['resume-file', resume?.id],
    queryFn: async ({ signal }): Promise<ResumeFileContent> =>
      resume!.mimeType === DOCX
        ? { kind: 'html', html: (await resumesApi.preview(resume!.id, signal)).html }
        : { kind: 'file', blob: await resumesApi.file(resume!.id, signal) },
    enabled: resume !== null,
    staleTime: Infinity,
  });
}
