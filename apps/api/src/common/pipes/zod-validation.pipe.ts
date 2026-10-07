import { type PipeTransform } from '@nestjs/common';
import { ErrorCode, type FieldError, isValidationRule, ValidationRule } from '@offerleap/shared';
import type { z } from 'zod';

import { AppException } from '../errors/app.exception';

/**
 * @description Converts Zod issues into `FieldError`s. Schemas in `@offerleap/shared` put a rule name in each
 * issue message; numeric limits travel as params so the web app can say "at least 8 characters".
 * @param issues - Issues from a failed parse.
 * @returns One entry per issue.
 */
export function toFieldErrors(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.map((issue) => {
    const params: Record<string, number> = {};
    if ('minimum' in issue) params.min = Number(issue.minimum);
    if ('maximum' in issue) params.max = Number(issue.maximum);
    return {
      field: issue.path.join('.'),
      rule: isValidationRule(issue.message) ? issue.message : ValidationRule.INVALID,
      ...(Object.keys(params).length > 0 && { params }),
    };
  });
}

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
