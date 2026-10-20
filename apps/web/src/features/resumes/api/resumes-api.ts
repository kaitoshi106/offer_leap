import type { ResumeSummary } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const resumesApi = {
  list: (signal?: AbortSignal) => apiRequest<ResumeSummary[]>('/resumes', { signal }),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<ResumeSummary>('/resumes', { method: 'POST', body });
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<ResumeSummary>(`/resumes/${id}`, { signal }),
  remove: (id: string) => apiRequest<void>(`/resumes/${id}`, { method: 'DELETE' }),
};
