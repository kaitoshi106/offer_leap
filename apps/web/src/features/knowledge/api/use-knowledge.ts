'use client';

import { AI_JOB_FINAL_STATUSES } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { knowledgeApi } from './knowledge-api';

const documentsKey = ['knowledge', 'documents'] as const;

/** The user's documents; refreshes itself while any is still being processed. */
export function useDocuments() {
  return useQuery({
    queryKey: documentsKey,
    queryFn: ({ signal }) => knowledgeApi.list(signal),
    refetchInterval: (query) =>
      query.state.data?.some((document) => !AI_JOB_FINAL_STATUSES.includes(document.status)) ? 1_500 : false,
  });
}

function useDocumentAction<TVariables, TResult>(action: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    // Documents and searches: results must not list a deleted document (or miss a new one).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });
}

export const useUploadDocument = () => useDocumentAction(knowledgeApi.upload);
export const useCreateTextDocument = () => useDocumentAction(knowledgeApi.createText);
export const useDeleteDocument = () => useDocumentAction(knowledgeApi.remove);

/** Runs a search for the submitted query (null = nothing searched yet). */
export function useKnowledgeSearch(query: string | null) {
  return useQuery({
    queryKey: ['knowledge', 'search', query],
    queryFn: ({ signal }) => knowledgeApi.search(query!, signal),
    enabled: query !== null,
  });
}
