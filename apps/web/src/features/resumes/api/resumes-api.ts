import type { ResumePreview, ResumeSummary } from '@offerleap/shared';

import { apiBlob, apiRequest } from '@/lib/api/client';

export const resumesApi = {
  list: (signal?: AbortSignal) => apiRequest<ResumeSummary[]>('/resumes', { signal }),
  /** `replaceId`: one of the user's CVs to delete in the same step, to make room at the CV limit. */
  upload: (file: File, replaceId?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (replaceId) body.append('replaceId', replaceId);
    return apiRequest<ResumeSummary>('/resumes', { method: 'POST', body });
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<ResumeSummary>(`/resumes/${id}`, { signal }),
  file: (id: string, signal?: AbortSignal) => apiBlob(`/resumes/${id}/file`, { signal }),
  preview: (id: string, signal?: AbortSignal) =>
    apiRequest<ResumePreview>(`/resumes/${id}/preview`, { signal }),
  remove: (id: string) => apiRequest<void>(`/resumes/${id}`, { method: 'DELETE' }),
};
