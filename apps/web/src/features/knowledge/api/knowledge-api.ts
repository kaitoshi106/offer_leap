import type { CreateTextDocumentInput, KnowledgeDocument, KnowledgeMatch } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const knowledgeApi = {
  list: (signal?: AbortSignal) => apiRequest<KnowledgeDocument[]>('/knowledge', { signal }),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<KnowledgeDocument>('/knowledge/upload', { method: 'POST', body });
  },
  createText: (body: CreateTextDocumentInput) =>
    apiRequest<KnowledgeDocument>('/knowledge/text', { method: 'POST', body }),
  remove: (id: string) => apiRequest<void>(`/knowledge/${id}`, { method: 'DELETE' }),
  search: (q: string, signal?: AbortSignal) =>
    apiRequest<KnowledgeMatch[]>(`/knowledge/search?${new URLSearchParams({ q })}`, { signal }),
};
