import type {
  AnalysisDetail,
  AnalysisSummary,
  CreateAnalysisInput,
  Paginated,
  PageQuery,
} from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const analysesApi = {
  list: ({ page, pageSize }: PageQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<AnalysisSummary>>(`/analyses?page=${page}&pageSize=${pageSize}`, { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<AnalysisDetail>(`/analyses/${id}`, { signal }),
  create: (body: CreateAnalysisInput) => apiRequest<AnalysisDetail>('/analyses', { method: 'POST', body }),
  remove: (id: string) => apiRequest<void>(`/analyses/${id}`, { method: 'DELETE' }),
};
