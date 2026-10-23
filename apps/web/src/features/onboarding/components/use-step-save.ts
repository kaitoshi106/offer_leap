'use client';

import type { OnboardingStep, SaveOnboardingStepInput, UpdateProfileSectionInput } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';

import { isApiError } from '@/lib/api/errors';
import { useMutateOnce } from '@/lib/api/use-mutate-once';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors } from '@/lib/forms/field-errors';
import { useServerValues } from '@/lib/forms/use-server-values';
import { useUnsavedChangesWarning } from '@/lib/forms/use-unsaved-changes-warning';

import { useSaveProfileSection } from '@/features/profile/api/use-profile';

import { useSaveOnboardingStep } from '../api/use-onboarding';

/** Where a step form saves: the onboarding draft, or the finished profile (profile page). */
export type StepFormMode = 'onboarding' | 'profile';

/**
 * @description Saves one step form and maps API field errors back onto its inputs (the API reports them as
 * `values.<field>` because the body is `{ step | section, values }`). The same forms serve the onboarding wizard
 * and the profile page; only the endpoint differs. The form also follows the saved values without losing what
 * is being typed (on the profile page, saving one section refreshes all three), and on the profile page leaving
 * with unsaved changes asks first.
 * @param step - Step / section being saved.
 * @param form - The step's `useForm` return value.
 * @param saved - The saved values in the form's input shape (also its `defaultValues`).
 * @param onSaved - Called after a successful save (e.g. go to the next step).
 * @param mode - Onboarding draft or profile.
 * @returns `submit(values)`, the active mutation (for pending state) and `saveError`: why the save failed when it
 *   isn't about one of the fields (those are shown on the inputs).
 */
export function useStepSave<TValues extends FieldValues, TTransformed extends FieldValues>(
  step: Exclude<OnboardingStep, 'review' | 'resume'>,
  form: UseFormReturn<TValues, unknown, TTransformed>,
  saved: NoInfer<DefaultValues<TValues>>,
  onSaved: () => void,
  mode: StepFormMode = 'onboarding',
) {
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  // Both hooks are always called (rules of hooks); only one is used.
  const onboarding = useSaveOnboardingStep();
  const profile = useSaveProfileSection();
  const save = mode === 'profile' ? profile : onboarding;
  const saveProfile = useMutateOnce(profile);
  const saveOnboarding = useMutateOnce(onboarding);
  useServerValues(form, saved);
  useUnsavedChangesWarning(mode === 'profile' && form.formState.isDirty, tCommon('unsavedChanges'));

  function submit(values: unknown) {
    const options = {
      onSuccess: () => {
        // What was typed is now saved.
        form.reset(form.getValues());
        onSaved();
      },
      onError: (error: unknown) => {
        if (!isApiError(error)) return;
        const fieldErrors = error.fieldErrors.map((fieldError) => ({
          ...fieldError,
          field: fieldError.field.replace(/^values\./, ''),
        }));
        applyServerFieldErrors(fieldErrors, form.setError);
      },
    };
    if (mode === 'profile') {
      saveProfile({ section: step, values } as UpdateProfileSectionInput, options);
    } else {
      saveOnboarding({ step, values } as SaveOnboardingStepInput, options);
    }
  }

  const saveError =
    save.error && !(isApiError(save.error) && save.error.fieldErrors.length > 0)
      ? errorText(save.error)
      : undefined;

  return { submit, save, saveError };
}
