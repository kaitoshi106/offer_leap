'use client';

import type { OnboardingStep, SaveOnboardingStepInput } from '@offerleap/shared';
import type { FieldValues, UseFormSetError } from 'react-hook-form';

import { isApiError } from '@/lib/api/errors';
import { applyServerFieldErrors } from '@/lib/forms/field-errors';

import { useSaveOnboardingStep } from '../api/use-onboarding';

/**
 * @description Saves one wizard step and maps API field errors back onto the step's inputs (the API reports them
 * as `values.<field>` because the body is `{ step, values }`).
 * @param step - Step being saved.
 * @param setError - From the step's `useForm`.
 * @param onSaved - Called after a successful save (e.g. go to the next step).
 * @returns `submit(values)` and the mutation (for pending/error state).
 */
export function useStepSave<TValues extends FieldValues>(
  step: Exclude<OnboardingStep, 'review'>,
  setError: UseFormSetError<TValues>,
  onSaved: () => void,
) {
  const save = useSaveOnboardingStep();

  function submit(values: unknown) {
    save.mutate({ step, values } as SaveOnboardingStepInput, {
      onSuccess: onSaved,
      onError: (error) => {
        if (!isApiError(error)) return;
        const fieldErrors = error.fieldErrors.map((fieldError) => ({
          ...fieldError,
          field: fieldError.field.replace(/^values\./, ''),
        }));
        applyServerFieldErrors(fieldErrors, setError);
      },
    });
  }

  return { submit, save };
}
