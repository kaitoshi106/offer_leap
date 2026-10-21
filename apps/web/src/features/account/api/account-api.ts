import type { AccountExport, DeleteAccountInput } from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

export const accountApi = {
  export: () => apiRequest<AccountExport>('/account/export'),
  // A wrong password is a 401 too: it's the answer, not an expired session to refresh.
  remove: (body: DeleteAccountInput) =>
    apiRequest<void>('/account', { method: 'DELETE', body, refreshOnUnauthorized: false }),
};
