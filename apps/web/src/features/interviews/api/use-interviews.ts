'use client';

import type { InterviewDetail } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { interviewsApi } from './interviews-api';

export const interviewsKey = ['interviews'] as const;
const interviewKey = (id: string) => [...interviewsKey, id] as const;

export function useInterviews() {
  return useQuery({ queryKey: interviewsKey, queryFn: ({ signal }) => interviewsApi.list(signal) });
}

export function useInterview(id: string) {
  return useQuery({ queryKey: interviewKey(id), queryFn: ({ signal }) => interviewsApi.get(id, signal) });
}

/** Every step returns the whole updated interview, which simply replaces the cached one. */
function useInterviewStep<TVariables>(id: string, step: (variables: TVariables) => Promise<InterviewDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: step,
    onSuccess: (interview) => {
      queryClient.setQueryData(interviewKey(id), interview);
      void queryClient.invalidateQueries({ queryKey: interviewsKey, exact: true });
    },
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: interviewsApi.create,
    onSuccess: (interview) => {
      queryClient.setQueryData(interviewKey(interview.id), interview);
      void queryClient.invalidateQueries({ queryKey: interviewsKey, exact: true });
    },
  });
}

export const useAnswerQuestion = (id: string) =>
  useInterviewStep(id, ({ index, answer }: { index: number; answer: string }) =>
    interviewsApi.answer(id, index, answer),
  );
export const useSkipQuestion = (id: string) =>
  useInterviewStep(id, (index: number) => interviewsApi.skip(id, index));
export const useCompleteInterview = (id: string) => useInterviewStep(id, () => interviewsApi.complete(id));

export function useDeleteInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: interviewsApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: interviewKey(id) });
      void queryClient.invalidateQueries({ queryKey: interviewsKey, exact: true });
    },
  });
}
