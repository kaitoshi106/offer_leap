import type {
  AdminIndustry,
  AdminInvitation,
  AdminUserDetail,
  AdminUserListItem,
  AdminUsersQueryInput,
  AiUsageStats,
  CreateIndustryInput,
  InviteAdminInput,
  Locale,
  Paginated,
  UpdateIndustryInput,
  UserStatus,
} from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

/** `?q=…&page=…` without empty values. */
function queryString(query: AdminUsersQueryInput): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const adminApi = {
  users: (query: AdminUsersQueryInput, signal?: AbortSignal) =>
    apiRequest<Paginated<AdminUserListItem>>(`/admin/users${queryString(query)}`, { signal }),
  user: (id: string, signal?: AbortSignal) => apiRequest<AdminUserDetail>(`/admin/users/${id}`, { signal }),
  setStatus: (id: string, status: UserStatus) =>
    apiRequest<AdminUserDetail>(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  setAiQuota: (id: string, aiDailyQuota: number | null) =>
    apiRequest<AdminUserDetail>(`/admin/users/${id}/ai-quota`, { method: 'PATCH', body: { aiDailyQuota } }),
  aiUsage: (days: number, signal?: AbortSignal) =>
    apiRequest<AiUsageStats>(`/admin/ai-usage?days=${days}`, { signal }),
  industries: (signal?: AbortSignal) => apiRequest<AdminIndustry[]>('/admin/industries', { signal }),
  createIndustry: (body: CreateIndustryInput) =>
    apiRequest<AdminIndustry>('/admin/industries', { method: 'POST', body }),
  updateIndustry: (code: string, body: UpdateIndustryInput) =>
    apiRequest<AdminIndustry>(`/admin/industries/${code}`, { method: 'PATCH', body }),
  removeIndustry: (code: string) => apiRequest<void>(`/admin/industries/${code}`, { method: 'DELETE' }),
  invitations: (signal?: AbortSignal) => apiRequest<AdminInvitation[]>('/admin/invitations', { signal }),
  invite: (body: InviteAdminInput) =>
    apiRequest<AdminInvitation>('/admin/invitations', { method: 'POST', body }),
  resend: (id: string, locale: Locale) =>
    apiRequest<AdminInvitation>(`/admin/invitations/${id}/resend`, { method: 'POST', body: { locale } }),
  revoke: (id: string) => apiRequest<void>(`/admin/invitations/${id}`, { method: 'DELETE' }),
};
