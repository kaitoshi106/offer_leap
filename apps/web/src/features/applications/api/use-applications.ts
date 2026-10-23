'use client';

import type {
  ApplicationDetail,
  ApplicationSummary,
  MoveApplication,
  UpdateApplicationInput,
} from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applicationsApi } from './applications-api';

const applicationsKey = ['applications'] as const;
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

const moveKey = [...applicationsKey, 'move'] as const;

/**
 * @description Moves a card. The board (and the card's own page) update at once (optimistic update) and roll back
 * if the API refuses, so dragging feels instant. With several moves in flight (quick successive drags), only the
 * last one to finish refetches — an earlier refetch would briefly put later cards back where they were.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: moveKey,
    mutationFn: ({ id, ...body }: MoveApplication & { id: string }) => applicationsApi.move(id, body),
    onMutate: async ({ id, status, position }) => {
      // Stop an in-flight refetch from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: applicationsKey });
      const previous = queryClient.getQueryData<ApplicationSummary[]>(applicationsKey);
      const previousDetail = queryClient.getQueryData<ApplicationDetail>(applicationKey(id));
      queryClient.setQueryData<ApplicationSummary[]>(applicationsKey, (cards) =>
        cards?.map((card) => (card.id === id ? { ...card, status, position } : card)),
      );
      queryClient.setQueryData<ApplicationDetail>(applicationKey(id), (application) =>
        application ? { ...application, status, position } : application,
      );
      return { previous, previousDetail };
    },
    onError: (_error, { id }, context) => {
      queryClient.setQueryData(applicationsKey, context?.previous);
      queryClient.setQueryData(applicationKey(id), context?.previousDetail);
    },
    onSettled: (_data, _error, { id }) => {
      // `isMutating` still counts this move while its onSettled runs.
      if (queryClient.isMutating({ mutationKey: moveKey }) > 1) return;
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: applicationKey(id) });
    },
  });
}

/**
 * @description Position for a card moved to the top of a column, from the cached board (the card itself
 * excluded). Without the board in the cache, `fallback` (e.g. the card's current position minus one).
 * @returns `(id, status, fallback) => position`.
 */
export function useTopOfColumn() {
  const queryClient = useQueryClient();
  return (id: string, status: ApplicationSummary['status'], fallback: number) => {
    const cards = queryClient.getQueryData<ApplicationSummary[]>(applicationsKey);
    if (!cards) return fallback;
    const positions = cards
      .filter((card) => card.status === status && card.id !== id)
      .map((card) => card.position);
    return positions.length > 0 ? Math.min(...positions) - 1 : 0;
  };
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applicationsApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: applicationKey(id) });
      void queryClient.invalidateQueries({ queryKey: applicationsKey, exact: true });
      // Interviews practised for it are kept, but no longer linked.
      void queryClient.invalidateQueries({ queryKey: ['interviews'] });
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
