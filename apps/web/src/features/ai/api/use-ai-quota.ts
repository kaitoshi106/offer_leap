'use client';

import type { AiQuotaStatus } from '@offerleap/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

/** The signed-in user's AI calls in the last 24 hours and their limit (null = unlimited). */
export function useAiQuota() {
  return useQuery({
    queryKey: ['ai', 'quota'],
    queryFn: ({ signal }) => apiRequest<AiQuotaStatus>('/ai/quota', { signal }),
  });
}
