import type { OnboardingState, ProvinceItem, SaveOnboardingStepInput, TaxonomyItem } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const onboardingApi = {
  state: (signal?: AbortSignal) => apiRequest<OnboardingState>('/onboarding', { signal }),
  saveStep: (body: SaveOnboardingStepInput) =>
    apiRequest<OnboardingState>('/onboarding/draft', { method: 'PUT', body }),
  complete: () => apiRequest<OnboardingState>('/onboarding/complete', { method: 'POST' }),
};

export const taxonomyApi = {
  industries: (signal?: AbortSignal) => apiRequest<TaxonomyItem[]>('/taxonomies/industries', { signal }),
  provinces: (signal?: AbortSignal) => apiRequest<ProvinceItem[]>('/taxonomies/provinces', { signal }),
};
