'use client';

import { type FieldError as ApiFieldError, toFieldErrors, type ValidationRule } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldError, FieldErrors, FieldValues, Path, Resolver, UseFormSetError } from 'react-hook-form';
import type { z } from 'zod';

/**
 * React Hook Form stores one string per field error. We store `{ rule, params }` as JSON there so client-side and
 * server-side errors are translated the same way (`validation.<rule>` with params).
 */
function encode(error: ApiFieldError): string {
  return JSON.stringify({ rule: error.rule, params: error.params });
}

/**
 * @description RHF resolver that validates with a shared Zod schema and reports errors exactly like the API does.
 * @param schema - Schema from `@offerleap/shared` (or a web-only extension of one).
 * @returns A resolver for `useForm({ resolver })`.
 */
export function sharedSchemaResolver<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
): Resolver<z.input<TSchema>, unknown, z.output<TSchema>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, FieldError> = {};
    for (const error of toFieldErrors(result.error.issues)) {
      errors[error.field] ??= { type: error.rule, message: encode(error) };
    }
    return { values: {}, errors: errors as FieldErrors<z.input<TSchema>> };
  };
}

/**
 * @description Puts API field errors (422) on the matching inputs.
 * @param fieldErrors - `ApiError.fieldErrors`.
 * @param setError - From `useForm`.
 * @returns `true` when at least one error matched a form field.
 */
export function applyServerFieldErrors<TValues extends FieldValues>(
  fieldErrors: ApiFieldError[],
  setError: UseFormSetError<TValues>,
): boolean {
  for (const error of fieldErrors) {
    setError(
      error.field as Path<TValues>,
      { type: error.rule, message: encode(error) },
      { shouldFocus: true },
    );
  }
  return fieldErrors.length > 0;
}

/**
 * @description Translates RHF errors produced by {@link sharedSchemaResolver} or {@link applyServerFieldErrors}.
 * Accepts array-field errors too (e.g. `skills`), which carry the list-level rule in `message`.
 * @returns `(error) => message | undefined`.
 */
export function useFieldErrorText(): (error: { message?: string } | undefined) => string | undefined {
  const t = useTranslations('validation');
  return useCallback(
    (error) => {
      if (!error?.message) return undefined;
      try {
        const { rule, params } = JSON.parse(error.message) as {
          rule: ValidationRule;
          params?: Record<string, number>;
        };
        return t(rule, params);
      } catch {
        return error.message;
      }
    },
    [t],
  );
}
