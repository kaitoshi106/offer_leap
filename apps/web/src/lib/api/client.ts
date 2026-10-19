import { ErrorCode } from '@offerleap/shared';

import { ApiError, NETWORK_ERROR, toApiError } from './errors';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Codes meaning "the access token is missing or expired" — fixable with a refresh. */
const SESSION_CODES = new Set<string>([ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED]);

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON, except `FormData` (file uploads), which the browser encodes as multipart itself. */
  body?: unknown;
  /** Try one session refresh on 401. Off for the auth endpoints themselves. Default `true`. */
  refreshOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * @description Rotates the session once, sharing the promise between concurrent callers: ten requests failing
 * with 401 at the same time trigger a single `/auth/refresh` (a second one would look like token reuse).
 * @returns Whether the session was refreshed.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * @description Calls the API with the session cookies, parses JSON and throws `ApiError` on failure.
 * @param path - Path after `/api/v1`, e.g. `/auth/me`.
 * @param options - Method, JSON body, refresh behaviour, abort signal.
 * @returns The parsed body, or `undefined` for empty responses (204/202).
 * @throws ApiError
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, refreshOnUnauthorized = true, signal } = options;

  const isJson = body !== undefined && !(body instanceof FormData);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      signal,
      // No Content-Type for FormData: the browser adds `multipart/form-data; boundary=…` itself.
      headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
      body: isJson ? JSON.stringify(body) : (body as FormData | undefined),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, NETWORK_ERROR);
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (response.ok) return data as T;

  const error = toApiError(response.status, data);
  if (
    refreshOnUnauthorized &&
    response.status === 401 &&
    SESSION_CODES.has(error.code) &&
    (await refreshSession())
  ) {
    return apiRequest<T>(path, { ...options, refreshOnUnauthorized: false });
  }
  throw error;
}
