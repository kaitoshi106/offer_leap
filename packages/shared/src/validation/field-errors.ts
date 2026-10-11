import type { z } from 'zod';

import type { FieldError } from '../errors/api-error';
import { isValidationRule, ValidationRule } from './rules';

/**
 * @description Converts Zod issues into `FieldError`s. Shared schemas put a rule name in each issue message;
 * numeric limits travel as params so clients can say "at least 8 characters". The API uses it for 422 bodies and
 * the web app for client-side validation, so both produce identical errors.
 * @param issues - Issues from a failed parse.
 * @returns One entry per issue.
 */
export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): FieldError[] {
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
