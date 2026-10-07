import type { ValidationRule } from '../validation/rules';
import { type ErrorCode, isErrorCode } from './error-codes';

/** A single field-level problem, used with `COMMON_VALIDATION_FAILED`. */
export interface FieldError {
  /** Dot path of the offending field, e.g. `profile.yearsOfExperience`. */
  field: string;
  /** Which rule failed; the web app translates `validation.<rule>`. */
  rule: ValidationRule;
  /** Values to interpolate into the translated message, e.g. `{ min: 8 }`. */
  params?: Record<string, string | number>;
}

/** Body of every non-2xx API response. */
export interface ApiErrorResponse {
  statusCode: number;
  code: ErrorCode;
  /** Developer-facing hint for logs. Never shown to end users. */
  message: string;
  fieldErrors?: FieldError[];
  /** Correlates a client report with server logs. */
  requestId?: string;
}

/**
 * @description Runtime check that a parsed response body has the API error shape.
 * @param body - Parsed JSON body of a failed request.
 * @returns `true` when `body` can be treated as an {@link ApiErrorResponse}.
 */
export function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.statusCode === 'number' && isErrorCode(candidate.code);
}
