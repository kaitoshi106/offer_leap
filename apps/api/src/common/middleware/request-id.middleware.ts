import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { AppRequest } from '../http/request';

const HEADER = 'x-request-id';
const VALID_ID = /^[\w-]{8,64}$/;

/**
 * Gives every request an id (reusing a valid incoming `X-Request-Id` from a proxy), echoes it in the response
 * and makes it available to logs and error bodies.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: AppRequest, response: Response, next: NextFunction): void {
    const incoming = request.header(HEADER);
    request.requestId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
    response.setHeader(HEADER, request.requestId);
    next();
  }
}
