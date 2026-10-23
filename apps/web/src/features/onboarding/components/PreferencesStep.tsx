'use client';

import {
  type PreferencesStep as PreferencesValues,
  type PreferencesStepInput,
  preferencesStepSchema,
  PROFILE_LIMITS,
  type ProfileValues,
  WORK_TYPES,
} from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { type DefaultValues, useForm } from 'react-hook-form';

import { Checkbox, Icon, Input, Text } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { StepActions } from './StepActions';
import { type StepFormMode, useStepSave } from './use-step-save';

/** Optional salary inputs: empty means "not provided" (`null`). */
const toOptionalNumber = (value: unknown) => (value === '' || value == null ? null : Number(value));

/** Step 3: expected salary range (optional) and work arrangements. */
export function PreferencesStep({
  mode = 'onboarding',
  values,
  onSaved,
  onBack,
}: {
  values: ProfileValues;
  onSaved: () => void;
  /** Omitted on the first wizard step and on the profile page. */
  onBack?: () => void;
  /** `profile`: same form on the profile page — saves the profile, one "Save" button. */
  mode?: StepFormMode;
}) {
  const t = useTranslations('onboarding');
  const fieldError = useFieldErrorText();
  const workTypesErrorId = useId();
  const saved: DefaultValues<PreferencesStepInput> = {
    expectedSalaryMin: values.expectedSalaryMin,
    expectedSalaryMax: values.expectedSalaryMax,
    workTypes: values.workTypes,
  };
  const form = useForm<PreferencesStepInput, unknown, PreferencesValues>({
    resolver: sharedSchemaResolver(preferencesStepSchema),
    defaultValues: saved,
  });
  const { submit, save, saveError } = useStepSave('preferences', form, saved, onSaved, mode);
  const { errors } = form.formState;
  const workTypesError = fieldError(errors.workTypes);
  const salaryInput = {
    type: 'number',
    inputMode: 'numeric',
    min: 0,
    max: PROFILE_LIMITS.salaryMax,
  } as const;

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-fg">{t('fields.salary')}</legend>
        <Text as="span" size="xs" tone="muted">
          {t('fields.salaryHint')}
        </Text>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('fields.salaryMin')} error={fieldError(errors.expectedSalaryMin)}>
            {(field) => (
              <Input
                {...field}
                {...form.register('expectedSalaryMin', { setValueAs: toOptionalNumber })}
                {...salaryInput}
              />
            )}
          </FormField>
          <FormField label={t('fields.salaryMax')} error={fieldError(errors.expectedSalaryMax)}>
            {(field) => (
              <Input
                {...field}
                {...form.register('expectedSalaryMax', { setValueAs: toOptionalNumber })}
                {...salaryInput}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset
        aria-describedby={workTypesError ? workTypesErrorId : undefined}
        className="flex flex-col gap-3"
      >
        <legend className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-fg">
          {t('fields.workTypes')}
          <span aria-hidden className="text-danger">
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {WORK_TYPES.map((workType) => (
            <label
              key={workType}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-sm text-fg has-checked:border-primary has-checked:bg-primary-soft"
            >
              <Checkbox {...form.register('workTypes')} value={workType} invalid={Boolean(workTypesError)} />
              {t(`workTypes.${workType}`)}
            </label>
          ))}
        </div>
        {workTypesError && (
          <Text
            as="span"
            id={workTypesErrorId}
            size="xs"
            tone="danger"
            role="alert"
            className="flex items-center gap-1"
          >
            <Icon name="alert-circle" size="xs" />
            {workTypesError}
          </Text>
        )}
      </fieldset>

      {mode === 'profile' ? (
        <StepActions
          loading={save.isPending}
          submitLabel={t('actions.save')}
          icon={false}
          error={saveError}
        />
      ) : (
        <StepActions onBack={onBack} loading={save.isPending} error={saveError} />
      )}
    </form>
  );
}
