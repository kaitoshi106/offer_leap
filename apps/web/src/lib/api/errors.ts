import { type ErrorCode, type FieldError, isApiErrorResponse } from '@offerleap/shared';

/** Client-side failures that never reach the API (offline, DNS, CORS…). Translated under `errors.*` like API codes. */
export const NETWORK_ERROR = 'NETWORK_ERROR';
/** A streamed answer stopped before it was complete (connection or AI failure mid-way). */
export const STREAM_INTERRUPTED = 'STREAM_INTERRUPTED';
export type ClientErrorCode = ErrorCode | typeof NETWORK_ERROR | typeof STREAM_INTERRUPTED;

/** A failed API call, normalised from the `ApiErrorResponse` body (or a network failure). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    readonly fieldErrors: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * @description Builds an `ApiError` from a non-2xx response body; unknown shapes become `COMMON_INTERNAL_ERROR`.
 * @param status - HTTP status.
 * @param body - Parsed JSON body (or `null`).
 */
export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorResponse(body))
    return new ApiError(status, body.code, body.fieldErrors ?? [], body.requestId);
  return new ApiError(status, 'COMMON_INTERNAL_ERROR');
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
