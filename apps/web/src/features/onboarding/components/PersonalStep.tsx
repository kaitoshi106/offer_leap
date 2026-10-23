'use client';

import {
  type PersonalStep as PersonalValues,
  type PersonalStepInput,
  personalStepSchema,
  type ProfileValues,
} from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, type DefaultValues, useForm } from 'react-hook-form';

import { Input } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { Combobox } from '@/components/organisms';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useTaxonomies } from '../api/use-onboarding';
import { toOptions } from './options';
import { StepActions } from './StepActions';
import { useSuggestionProps } from './SuggestionBadge';
import type { SuggestedFields } from './suggestions';
import { type StepFormMode, useStepSave } from './use-step-save';

/** Step 1: name, phone (optional) and province. */
export function PersonalStep({
  mode = 'onboarding',
  values,
  suggested = {},
  onSaved,
  onBack,
}: {
  values: ProfileValues;
  /** Fields pre-filled from the CV. */
  suggested?: SuggestedFields;
  onSaved: () => void;
  /** Omitted on the first wizard step and on the profile page. */
  onBack?: () => void;
  /** `profile`: same form on the profile page — saves the profile, one "Save" button. */
  mode?: StepFormMode;
}) {
  const t = useTranslations('onboarding');
  const suggestion = useSuggestionProps();
  const locale = useLocale();
  const fieldError = useFieldErrorText();
  const { provinces } = useTaxonomies();
  const saved: DefaultValues<PersonalStepInput> = {
    fullName: values.fullName,
    phone: values.phone ?? '',
    provinceCode: values.provinceCode ?? '',
  };
  const form = useForm<PersonalStepInput, unknown, PersonalValues>({
    resolver: sharedSchemaResolver(personalStepSchema),
    defaultValues: saved,
  });
  const { submit, save, saveError } = useStepSave('personal', form, saved, onSaved, mode);
  const { errors } = form.formState;

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
      <FormField
        label={t('fields.fullName')}
        {...suggestion(suggested.fullName)}
        error={fieldError(errors.fullName)}
        required
      >
        {(field) => <Input {...field} {...form.register('fullName')} autoComplete="name" />}
      </FormField>

      <FormField
        label={t('fields.phone')}
        {...suggestion(suggested.phone, t('fields.phoneHint'))}
        error={fieldError(errors.phone)}
      >
        {(field) => (
          <Input {...field} {...form.register('phone')} type="tel" inputMode="tel" autoComplete="tel" />
        )}
      </FormField>

      <FormField
        label={t('fields.province')}
        {...suggestion(suggested.provinceCode)}
        error={fieldError(errors.provinceCode)}
        required
      >
        {(field) => (
          <Controller
            control={form.control}
            name="provinceCode"
            render={({ field: control }) => (
              <Combobox
                {...field}
                ref={control.ref}
                options={toOptions(provinces.data, locale)}
                value={control.value || null}
                onChange={(code) => control.onChange(code ?? '')}
                onBlur={control.onBlur}
                placeholder={t('fields.provincePlaceholder')}
                noResultsLabel={t('noResults')}
              />
            )}
          />
        )}
      </FormField>

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
