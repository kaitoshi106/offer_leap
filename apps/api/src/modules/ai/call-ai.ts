import { ErrorCode } from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { AiInvalidOutputError, AiUnavailableError } from './ai.errors';

/**
 * @description Runs an AI call made inside an HTTP request (not a background job) and turns AI errors into API
 * errors: no model available → 503 `AI_UNAVAILABLE` (try later), unusable answer → 502 `AI_FAILED`.
 * @param call - The AI work.
 * @throws AppException for AI failures; other errors pass through.
 */
export async function callAi<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AiUnavailableError)
      throw new AppException(ErrorCode.AI_UNAVAILABLE, { cause: error });
    if (error instanceof AiInvalidOutputError) throw new AppException(ErrorCode.AI_FAILED, { cause: error });
    throw error;
  }
}
