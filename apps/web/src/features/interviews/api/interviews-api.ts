import type { CreateInterviewInput, InterviewDetail, InterviewListItem } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const interviewsApi = {
  list: (signal?: AbortSignal) => apiRequest<InterviewListItem[]>('/interviews', { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<InterviewDetail>(`/interviews/${id}`, { signal }),
  create: (body: CreateInterviewInput) =>
    apiRequest<InterviewDetail>('/interviews', { method: 'POST', body }),
  answer: (id: string, index: number, answer: string) =>
    apiRequest<InterviewDetail>(`/interviews/${id}/questions/${index}/answer`, {
      method: 'POST',
      body: { answer },
    }),
  skip: (id: string, index: number) =>
    apiRequest<InterviewDetail>(`/interviews/${id}/questions/${index}/skip`, { method: 'POST' }),
  complete: (id: string) => apiRequest<InterviewDetail>(`/interviews/${id}/complete`, { method: 'POST' }),
  remove: (id: string) => apiRequest<void>(`/interviews/${id}`, { method: 'DELETE' }),
};
