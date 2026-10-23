'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * @description Keeps a form in step with the saved record without losing what the user is typing. When `values`
 * change (another part of the page saved the record, or a refetch brought news), fields the user hasn't touched
 * take the new values and edited ones are kept — unlike remounting the form with a new `key`, which wipes them.
 * Compared by content, so a refetch that changed nothing does nothing.
 * @param form - The form's `useForm` return value.
 * @param values - The saved values, in the form's input shape (the same object passed as `defaultValues`).
 */
export function useServerValues<TValues extends FieldValues, TContext, TTransformed extends FieldValues>(
  form: UseFormReturn<TValues, TContext, TTransformed>,
  values: NoInfer<DefaultValues<TValues>>,
) {
  const signature = JSON.stringify(values);
  const applied = useRef(signature);
  const apply = useEffectEvent(() => form.reset(values, { keepDirtyValues: true }));

  useEffect(() => {
    if (signature === applied.current) return;
    applied.current = signature;
    apply();
  }, [signature]);
}
