'use client';

import type {
  ApplicationDetail,
  ApplicationSummary,
  MoveApplication,
  UpdateApplicationInput,
} from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applicationsApi } from './applications-api';

export const applicationsKey = ['applications'] as const;
const applicationKey = (id: string) => [...applicationsKey, id] as const;

export function useApplications() {
  return useQuery({ queryKey: applicationsKey, queryFn: ({ signal }) => applicationsApi.list(signal) });
}

export function useApplication(id: string) {
  return useQuery({ queryKey: applicationKey(id), queryFn: ({ signal }) => applicationsApi.get(id, signal) });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applicationsApi.create,
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKey(application.id), application);
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
    },
  });
}

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateApplicationInput) => applicationsApi.update(id, body),
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKey(id), application);
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
    },
  });
}

/**
 * @description Moves a card. The board updates at once (optimistic update) and rolls back if the API refuses,
 * so dragging feels instant.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MoveApplication & { id: string }) => applicationsApi.move(id, body),
    onMutate: async ({ id, status, position }) => {
      // Stop an in-flight refetch from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: applicationsKey, exact: true });
      const previous = queryClient.getQueryData<ApplicationSummary[]>(applicationsKey);
      queryClient.setQueryData<ApplicationSummary[]>(applicationsKey, (cards) =>
        cards?.map((card) => (card.id === id ? { ...card, status, position } : card)),
      );
      return { previous };
    },
    onError: (_error, _move, context) => queryClient.setQueryData(applicationsKey, context?.previous),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: applicationKey(id) });
    },
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applicationsApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: applicationKey(id) });
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
    },
  });
}

/** Stores a finished, streamed cover letter in the cache (the API has already saved it). */
export function useSetCoverLetter(id: string) {
  const queryClient = useQueryClient();
  return (coverLetter: string) => {
    queryClient.setQueryData<ApplicationDetail>(applicationKey(id), (application) =>
      application ? { ...application, coverLetter, hasCoverLetter: true } : application,
    );
    void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
  };
}
