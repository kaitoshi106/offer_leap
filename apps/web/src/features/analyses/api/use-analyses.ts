'use client';

import { type AnalysisDetail, type PageQuery, RESUME_FINAL_STATUSES } from '@offerleap/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { analysesApi } from './analyses-api';

/** How often to ask whether the AI has finished. */
const POLL_INTERVAL_MS = 2_000;

const analysesKey = ['analyses'] as const;
/** Every page of the history; invalidated whenever an analysis is added, finished or deleted. */
const analysesListKey = [...analysesKey, 'list'] as const;
const analysisKey = (id: string) => [...analysesKey, id] as const;

const isFinal = (analysis: { status: AnalysisDetail['status'] }) =>
  RESUME_FINAL_STATUSES.includes(analysis.status);

/**
 * @description One page of the history, newest first. Refreshes itself while an analysis on it is still running;
 * the previous page stays on screen while the next one loads.
 * @param query - Page and page size.
 */
export function useAnalyses(query: PageQuery) {
  return useQuery({
    queryKey: [...analysesListKey, query.page, query.pageSize],
    queryFn: ({ signal }) => analysesApi.list(query, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (state) =>
      state.state.data?.items.some((analysis) => !isFinal(analysis)) ? POLL_INTERVAL_MS : false,
  });
}

/**
 * @description One analysis, polled until the AI has finished; then the history is refreshed so it shows the
 * score too.
 * @param id - Analysis id.
 */
export function useAnalysis(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: analysisKey(id),
    queryFn: async ({ signal }) => {
      const analysis = await analysesApi.get(id, signal);
      if (isFinal(analysis)) void queryClient.invalidateQueries({ queryKey: analysesListKey });
      return analysis;
    },
    refetchInterval: (query) => (query.state.data && !isFinal(query.state.data) ? POLL_INTERVAL_MS : false),
  });
}

/** Starts an analysis; the created (pending) analysis is cached so its page opens without a loading state. */
export function useCreateAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analysesApi.create,
    onSuccess: (analysis) => {
      queryClient.setQueryData(analysisKey(analysis.id), analysis);
      void queryClient.invalidateQueries({ queryKey: analysesListKey });
    },
  });
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analysesApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: analysisKey(id) });
      void queryClient.invalidateQueries({ queryKey: analysesListKey });
      // Applications saved from it lose their score and link.
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
