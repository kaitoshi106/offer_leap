import { ErrorCode } from '@offerleap/shared';

import { ApiError, isApiError, NETWORK_ERROR, STREAM_INTERRUPTED, toApiError } from './errors';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Codes meaning "the access token is missing or expired" — fixable with a refresh. */
const SESSION_CODES = new Set<string>([ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED]);

/**
 * @description Whether a failed request means the session is gone for good: requests refresh once on their own,
 * so a session error that still reaches the caller could not be refreshed (signed out elsewhere, password changed
 * on another device, session expired).
 * @param error - Anything thrown by {@link apiRequest}.
 */
export function isSessionEnded(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && SESSION_CODES.has(error.code);
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON, except `FormData` (file uploads), which the browser encodes as multipart itself. */
  body?: unknown;
  /** Try one session refresh on 401. Off for the auth endpoints themselves. Default `true`. */
  refreshOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

/** How long to let another tab's refresh land its new cookies before trying again. */
const REFRESH_RACE_DELAY_MS = 300;

async function postRefresh(): Promise<'ok' | 'race' | 'failed'> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (response.ok) return 'ok';
    if (response.status !== 409) return 'failed';
    const body: unknown = await response.json().catch(() => null);
    return toApiError(409, body).code === ErrorCode.AUTH_REFRESH_RACE ? 'race' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * @description Rotates the session once, sharing the promise between concurrent callers: ten requests failing
 * with 401 at the same time trigger a single `/auth/refresh` (a second one would look like token reuse). Other
 * tabs share the cookies but not this promise: when one of them rotated the token a moment earlier the API
 * answers `AUTH_REFRESH_RACE` (keeping the cookies), and one more try a little later uses that tab's new token.
 * @returns Whether the session was refreshed.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    let result = await postRefresh();
    if (result === 'race') {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RACE_DELAY_MS));
      result = await postRefresh();
    }
    return result === 'ok';
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * @description Sends a request with the session cookies. On a 401 caused by an expired access token, refreshes
 * the session once and retries.
 * @returns The successful response (body not read yet).
 * @throws ApiError for network failures and non-2xx responses.
 */
async function send(path: string, options: ApiRequestOptions): Promise<Response> {
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
  if (response.ok) return response;

  const text = await response.text();
  const error = toApiError(response.status, text ? safeJson(text) : null);
  if (
    refreshOnUnauthorized &&
    response.status === 401 &&
    SESSION_CODES.has(error.code) &&
    (await refreshSession())
  ) {
    return send(path, { ...options, refreshOnUnauthorized: false });
  }
  throw error;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @description Calls the API with the session cookies, parses JSON and throws `ApiError` on failure.
 * @param path - Path after `/api/v1`, e.g. `/auth/me`.
 * @param options - Method, JSON body, refresh behaviour, abort signal.
 * @returns The parsed body, or `undefined` for empty responses (204/202).
 * @throws ApiError
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * @description Downloads a file (e.g. an uploaded CV) with the session cookies, for showing it in the page.
 * @param path - Path after `/api/v1`.
 * @param options - As for {@link apiRequest}.
 * @returns The file's contents with the type the API sent.
 * @throws ApiError
 */
export async function apiBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  const response = await send(path, options);
  return response.blob();
}

/**
 * @description Calls an endpoint that streams plain text (e.g. an AI writing a letter) and reports the text so
 * far after every piece. Errors before streaming starts are normal `ApiError`s (validation, AI unavailable).
 * @param path - Path after `/api/v1`.
 * @param options - As for {@link apiRequest}, plus `onText(textSoFar)`.
 * @returns The complete text.
 * @throws ApiError — `STREAM_INTERRUPTED` when the stream breaks off half-way.
 */
export async function apiStream(
  path: string,
  options: ApiRequestOptions & { onText: (text: string) => void },
): Promise<string> {
  const response = await send(path, options);
  if (!response.body) throw new ApiError(response.status, STREAM_INTERRUPTED);

  const reader = response.body.getReader();
  // `stream: true` keeps a multi-byte character (Vietnamese diacritics) split across two pieces intact.
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      options.onText(text);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(response.status, STREAM_INTERRUPTED);
  }
  return text + decoder.decode();
}
