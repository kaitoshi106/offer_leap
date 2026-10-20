import type {
  ApplicationDetail,
  ApplicationSummary,
  CreateApplicationInput,
  Locale,
  MoveApplication,
  UpdateApplicationInput,
} from '@offerleap/shared';

import { apiRequest, apiStream } from '@/lib/api/client';

export const applicationsApi = {
  list: (signal?: AbortSignal) => apiRequest<ApplicationSummary[]>('/applications', { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<ApplicationDetail>(`/applications/${id}`, { signal }),
  create: (body: CreateApplicationInput) =>
    apiRequest<ApplicationDetail>('/applications', { method: 'POST', body }),
  update: (id: string, body: UpdateApplicationInput) =>
    apiRequest<ApplicationDetail>(`/applications/${id}`, { method: 'PATCH', body }),
  move: (id: string, body: MoveApplication) =>
    apiRequest<ApplicationSummary>(`/applications/${id}/move`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/applications/${id}`, { method: 'DELETE' }),
  coverLetter: (id: string, locale: Locale, onText: (text: string) => void, signal?: AbortSignal) =>
    apiStream(`/applications/${id}/cover-letter`, { method: 'POST', body: { locale }, onText, signal }),
};
