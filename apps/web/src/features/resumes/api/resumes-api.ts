import type { ResumeSummary } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const resumesApi = {
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<ResumeSummary>('/resumes', { method: 'POST', body });
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<ResumeSummary>(`/resumes/${id}`, { signal }),
};
