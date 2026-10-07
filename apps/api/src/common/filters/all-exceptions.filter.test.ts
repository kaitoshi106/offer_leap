import { type ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@offerleap/shared';
import { describe, expect, it, vi } from 'vitest';

import { AppException } from '../errors/app.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * @description Runs the filter and returns what it wrote to the response.
 */
function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn((_statusCode: number) => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: 'req-1', method: 'GET', originalUrl: '/x' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter', () => {
  it('serialises AppException with its code, status and request id', () => {
    expect(run(new AppException(ErrorCode.AUTH_EMAIL_TAKEN))).toEqual({
      status: 409,
      body: { statusCode: 409, code: 'AUTH_EMAIL_TAKEN', message: 'AUTH_EMAIL_TAKEN', requestId: 'req-1' },
    });
  });

  it('maps framework HTTP errors (e.g. unknown route) to shared codes', () => {
    expect(run(new NotFoundException()).body).toMatchObject({ statusCode: 404, code: 'COMMON_NOT_FOUND' });
  });

  it('hides details of unexpected errors', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const { status, body } = run(new Error('database password is hunter2'));
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: 'COMMON_INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: 'req-1',
    });
    expect(logError).toHaveBeenCalledOnce();
  });
});
