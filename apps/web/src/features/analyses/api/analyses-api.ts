import type { AnalysisDetail, AnalysisSummary, CreateAnalysisInput } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const analysesApi = {
  list: (signal?: AbortSignal) => apiRequest<AnalysisSummary[]>('/analyses', { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<AnalysisDetail>(`/analyses/${id}`, { signal }),
  create: (body: CreateAnalysisInput) => apiRequest<AnalysisDetail>('/analyses', { method: 'POST', body }),
  remove: (id: string) => apiRequest<void>(`/analyses/${id}`, { method: 'DELETE' }),
};
