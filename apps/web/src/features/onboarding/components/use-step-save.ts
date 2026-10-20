'use client';

import type { OnboardingStep, SaveOnboardingStepInput, UpdateProfileSectionInput } from '@offerleap/shared';
import type { FieldValues, UseFormSetError } from 'react-hook-form';

import { isApiError } from '@/lib/api/errors';
import { applyServerFieldErrors } from '@/lib/forms/field-errors';

import { useSaveProfileSection } from '@/features/profile/api/use-profile';

import { useSaveOnboardingStep } from '../api/use-onboarding';

/** Where a step form saves: the onboarding draft, or the finished profile (profile page). */
export type StepFormMode = 'onboarding' | 'profile';

/**
 * @description Saves one step form and maps API field errors back onto its inputs (the API reports them as
 * `values.<field>` because the body is `{ step | section, values }`). The same forms serve the onboarding wizard
 * and the profile page; only the endpoint differs.
 * @param step - Step / section being saved.
 * @param setError - From the step's `useForm`.
 * @param onSaved - Called after a successful save (e.g. go to the next step).
 * @param mode - Onboarding draft or profile.
 * @returns `submit(values)` and the active mutation (for pending/error state).
 */
export function useStepSave<TValues extends FieldValues>(
  step: Exclude<OnboardingStep, 'review' | 'resume'>,
  setError: UseFormSetError<TValues>,
  onSaved: () => void,
  mode: StepFormMode = 'onboarding',
) {
  // Both hooks are always called (rules of hooks); only one is used.
  const onboarding = useSaveOnboardingStep();
  const profile = useSaveProfileSection();
  const save = mode === 'profile' ? profile : onboarding;

  function submit(values: unknown) {
    const options = {
      onSuccess: onSaved,
      onError: (error: unknown) => {
        if (!isApiError(error)) return;
        const fieldErrors = error.fieldErrors.map((fieldError) => ({
          ...fieldError,
          field: fieldError.field.replace(/^values\./, ''),
        }));
        applyServerFieldErrors(fieldErrors, setError);
      },
    };
    if (mode === 'profile') {
      profile.mutate({ section: step, values } as UpdateProfileSectionInput, options);
    } else {
      onboarding.mutate({ step, values } as SaveOnboardingStepInput, options);
    }
  }

  return { submit, save };
}
