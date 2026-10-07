import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorResponse, ERROR_HTTP_STATUS, ErrorCode } from '@offerleap/shared';
import type { Response } from 'express';

import { AppException } from '../errors/app.exception';
import type { AppRequest } from '../http/request';

/** Framework errors (thrown by Nest itself, not our code) mapped to our codes by status. */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.AUTH_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.COMMON_RATE_LIMITED,
};

/**
 * Turns every thrown value into an `ApiErrorResponse`. Unknown errors become `COMMON_INTERNAL_ERROR` and are
 * logged with the request id; their details never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();
    const body = this.toBody(exception, request);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${body.code} [${request.requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, request: AppRequest): ApiErrorResponse {
    const requestId = request.requestId;

    if (exception instanceof AppException) {
      return {
        statusCode: exception.status,
        code: exception.code,
        message: exception.message,
        ...(exception.fieldErrors && { fieldErrors: exception.fieldErrors }),
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const code = STATUS_TO_CODE[statusCode];
      if (code) return { statusCode, code, message: exception.message, requestId };
    }

    return {
      statusCode: ERROR_HTTP_STATUS.COMMON_INTERNAL_ERROR,
      code: ErrorCode.COMMON_INTERNAL_ERROR,
      message: 'Internal server error',
      requestId,
    };
  }
}
