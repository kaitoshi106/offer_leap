'use client';

import { type AnalysisDetail, RESUME_FINAL_STATUSES } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { analysesApi } from './analyses-api';

/** How often to ask whether the AI has finished. */
const POLL_INTERVAL_MS = 2_000;

export const analysesKey = ['analyses'] as const;
const analysisKey = (id: string) => [...analysesKey, id] as const;

const isFinal = (analysis: { status: AnalysisDetail['status'] }) =>
  RESUME_FINAL_STATUSES.includes(analysis.status);

/** History, newest first. Refreshes itself while an analysis in it is still running. */
export function useAnalyses() {
  return useQuery({
    queryKey: analysesKey,
    queryFn: ({ signal }) => analysesApi.list(signal),
    refetchInterval: (query) =>
      query.state.data?.some((analysis) => !isFinal(analysis)) ? POLL_INTERVAL_MS : false,
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
      if (isFinal(analysis)) void queryClient.invalidateQueries({ queryKey: analysesKey, exact: true });
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
      void queryClient.invalidateQueries({ queryKey: analysesKey, exact: true });
    },
  });
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analysesApi.remove,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: analysisKey(id) });
      void queryClient.invalidateQueries({ queryKey: analysesKey, exact: true });
    },
  });
}
