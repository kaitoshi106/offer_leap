import type {
  AdminInvitation,
  AdminUserDetail,
  AdminUserListItem,
  AdminUsersQueryInput,
  InviteAdminInput,
  Locale,
  Paginated,
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
  invitations: (signal?: AbortSignal) => apiRequest<AdminInvitation[]>('/admin/invitations', { signal }),
  invite: (body: InviteAdminInput) =>
    apiRequest<AdminInvitation>('/admin/invitations', { method: 'POST', body }),
  resend: (id: string, locale: Locale) =>
    apiRequest<AdminInvitation>(`/admin/invitations/${id}/resend`, { method: 'POST', body: { locale } }),
  revoke: (id: string) => apiRequest<void>(`/admin/invitations/${id}`, { method: 'DELETE' }),
};
