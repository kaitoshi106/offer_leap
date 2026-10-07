import { ERROR_HTTP_STATUS, type ErrorCode, type FieldError } from '@offerleap/shared';

interface AppExceptionOptions {
  /** Developer-facing detail for logs and the `message` field. Never user-facing copy. */
  message?: string;
  fieldErrors?: FieldError[];
  cause?: unknown;
}

/**
 * The only exception business code should throw. Carries an `ErrorCode`; the HTTP status comes from the shared
 * `ERROR_HTTP_STATUS` map and the web app picks the translated message.
 */
export class AppException extends Error {
  readonly status: number;
  readonly fieldErrors?: FieldError[];

  constructor(
    readonly code: ErrorCode,
    { message, fieldErrors, cause }: AppExceptionOptions = {},
  ) {
    super(message ?? code, { cause });
    this.name = 'AppException';
    this.status = ERROR_HTTP_STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}
