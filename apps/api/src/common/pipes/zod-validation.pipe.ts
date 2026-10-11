import { type PipeTransform } from '@nestjs/common';
import { ErrorCode, toFieldErrors } from '@offerleap/shared';
import type { z } from 'zod';

import { AppException } from '../errors/app.exception';

/**
 * Validates and transforms a request part with a Zod schema. Usage: `@Body(new ZodValidationPipe(schema))`.
 * The handler receives the parsed (trimmed, lower-cased…) value, never the raw input.
 */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'Request validation failed',
        fieldErrors: toFieldErrors(result.error.issues),
      });
    }
    return result.data;
  }
}
