import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, refreshSession } from './client';
import { ApiError } from './errors';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });
const error = (status: number, code: string) => json(status, { statusCode: status, code, message: code });

describe('apiRequest', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends JSON with credentials and parses the response', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest('/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/x',
      expect.objectContaining({ method: 'POST', credentials: 'include', body: '{"a":1}' }),
    );
  });

  it('returns undefined for empty responses', async () => {
    fetchMock.mockResolvedValueOnce(json(204));
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the code and field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        statusCode: 422,
        code: 'COMMON_VALIDATION_FAILED',
        message: 'x',
        fieldErrors: [{ field: 'email', rule: 'invalidEmail' }],
      }),
    );

    await expect(apiRequest('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      code: 'COMMON_VALIDATION_FAILED',
      fieldErrors: [{ field: 'email', rule: 'invalidEmail' }],
    });
  });

  it('refreshes the session once on 401 and retries', async () => {
    fetchMock
      .mockResolvedValueOnce(error(401, 'AUTH_TOKEN_EXPIRED'))
      .mockResolvedValueOnce(json(200, { user: {} }))
      .mockResolvedValueOnce(json(200, { id: 'u1' }));

    await expect(apiRequest('/auth/me')).resolves.toEqual({ id: 'u1' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/api/v1/auth/me',
      'http://localhost:4000/api/v1/auth/refresh',
      'http://localhost:4000/api/v1/auth/me',
    ]);
  });

  it('gives up when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(error(401, 'AUTH_UNAUTHENTICATED'))
      .mockResolvedValueOnce(error(400, 'AUTH_TOKEN_INVALID'));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'AUTH_UNAUTHENTICATED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh for wrong credentials on login', async () => {
    fetchMock.mockResolvedValueOnce(error(401, 'AUTH_INVALID_CREDENTIALS'));

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: {}, refreshOnUnauthorized: false }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('refreshSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shares one request between concurrent callers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits and tries again when another tab refreshed the session at the same moment', async () => {
    // The other tab's refresh won; its new cookies arrive, and the second try succeeds with them.
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(error(409, 'AUTH_REFRESH_RACE'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not loop when the race keeps happening', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => error(409, 'AUTH_REFRESH_RACE'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
