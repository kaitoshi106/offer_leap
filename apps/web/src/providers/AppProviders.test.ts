import { describe, expect, it } from 'vitest';

import { currentUserKey } from '@/features/auth/api/use-auth';
import { ApiError, NETWORK_ERROR } from '@/lib/api/errors';

import { makeQueryClient } from './AppProviders';

const user = { id: 'u1', email: 'a@b.co', fullName: 'Minh' };

describe('makeQueryClient', () => {
  it('retries network and server failures, but not answers that a retry cannot change', () => {
    const retry = makeQueryClient().getDefaultOptions().queries?.retry as (
      failures: number,
      error: unknown,
    ) => boolean;

    // A deleted record or a forbidden page: show it at once instead of a skeleton for several seconds.
    expect(retry(0, new ApiError(404, 'COMMON_NOT_FOUND'))).toBe(false);
    expect(retry(0, new ApiError(422, 'COMMON_VALIDATION_FAILED'))).toBe(false);
    // Worth another try, a couple of times.
    expect(retry(0, new ApiError(0, NETWORK_ERROR))).toBe(true);
    expect(retry(0, new ApiError(503, 'AI_UNAVAILABLE'))).toBe(true);
    expect(retry(2, new ApiError(503, 'AI_UNAVAILABLE'))).toBe(false);
  });

  it('marks the user signed out when any request finds the session gone (the shell then goes to login)', async () => {
    const client = makeQueryClient();
    client.setQueryData(currentUserKey, user);

    await client
      .fetchQuery({
        queryKey: ['applications'],
        queryFn: () => Promise.reject(new ApiError(401, 'AUTH_TOKEN_EXPIRED')),
      })
      .catch(() => undefined);
    expect(client.getQueryData(currentUserKey)).toBeNull();

    // Mutations too (e.g. saving after the password was changed on another device).
    client.setQueryData(currentUserKey, user);
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new ApiError(401, 'AUTH_UNAUTHENTICATED')) })
      .execute(undefined)
      .catch(() => undefined);
    expect(client.getQueryData(currentUserKey)).toBeNull();
  });

  it('leaves the user alone for other 401s, like a wrong password', async () => {
    const client = makeQueryClient();
    client.setQueryData(currentUserKey, user);
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new ApiError(401, 'AUTH_INVALID_CREDENTIALS')) })
      .execute(undefined)
      .catch(() => undefined);
    expect(client.getQueryData(currentUserKey)).toEqual(user);
  });
});
