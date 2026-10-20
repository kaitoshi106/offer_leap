import type { ProfileValues, UpdateProfileSectionInput } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const profileApi = {
  get: (signal?: AbortSignal) => apiRequest<ProfileValues>('/profile', { signal }),
  saveSection: (body: UpdateProfileSectionInput) =>
    apiRequest<ProfileValues>('/profile/sections', { method: 'PUT', body }),
};
