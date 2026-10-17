/**
 * Single source of truth for API error codes.
 *
 * - The API throws these codes and never sends user-facing text.
 * - The web app translates each code via `errors.<CODE>` in its messages files.
 * - Naming: `<DOMAIN>_<REASON>` in UPPER_SNAKE_CASE; the key always equals its value.
 */
export const ErrorCode = {
  // Common
  COMMON_INTERNAL_ERROR: 'COMMON_INTERNAL_ERROR',
  COMMON_VALIDATION_FAILED: 'COMMON_VALIDATION_FAILED',
  COMMON_NOT_FOUND: 'COMMON_NOT_FOUND',
  COMMON_RATE_LIMITED: 'COMMON_RATE_LIMITED',

  // Auth
  AUTH_UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_PASSWORD_CHANGE_NOT_ALLOWED: 'AUTH_PASSWORD_CHANGE_NOT_ALLOWED',
  AUTH_EMAIL_ALREADY_VERIFIED: 'AUTH_EMAIL_ALREADY_VERIFIED',

  // Onboarding
  ONBOARDING_REQUIRED: 'ONBOARDING_REQUIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status the API responds with for each code. `satisfies` makes a missing entry a compile error. */
export const ERROR_HTTP_STATUS = {
  COMMON_INTERNAL_ERROR: 500,
  COMMON_VALIDATION_FAILED: 422,
  COMMON_NOT_FOUND: 404,
  COMMON_RATE_LIMITED: 429,

  AUTH_UNAUTHENTICATED: 401,
  AUTH_FORBIDDEN: 403,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_EMAIL_TAKEN: 409,
  AUTH_EMAIL_NOT_VERIFIED: 403,
  AUTH_TOKEN_INVALID: 400,
  AUTH_TOKEN_EXPIRED: 410,
  AUTH_ACCOUNT_LOCKED: 423,
  AUTH_PASSWORD_CHANGE_NOT_ALLOWED: 403,
  AUTH_EMAIL_ALREADY_VERIFIED: 409,

  ONBOARDING_REQUIRED: 403,
} as const satisfies Record<ErrorCode, number>;

const ERROR_CODE_SET: ReadonlySet<string> = new Set(Object.values(ErrorCode));

/**
 * @description Narrows an unknown value (e.g. a field from a JSON response) to a known error code.
 * @param value - Value to check.
 * @returns `true` when `value` is a registered {@link ErrorCode}.
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODE_SET.has(value);
}
