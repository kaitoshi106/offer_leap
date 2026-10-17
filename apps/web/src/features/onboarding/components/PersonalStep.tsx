'use client';

import {
  type PersonalStep as PersonalValues,
  type PersonalStepInput,
  personalStepSchema,
  type ProfileValues,
} from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { Input } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { Combobox } from '@/components/organisms';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useTaxonomies } from '../api/use-onboarding';
import { toOptions } from './options';
import { StepActions } from './StepActions';
import { useStepSave } from './use-step-save';

/** Step 1: name, phone (optional) and province. */
export function PersonalStep({ values, onSaved }: { values: ProfileValues; onSaved: () => void }) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const fieldError = useFieldErrorText();
  const { provinces } = useTaxonomies();
  const form = useForm<PersonalStepInput, unknown, PersonalValues>({
    resolver: sharedSchemaResolver(personalStepSchema),
    defaultValues: {
      fullName: values.fullName,
      phone: values.phone ?? '',
      provinceCode: values.provinceCode ?? '',
    },
  });
  const { submit, save } = useStepSave('personal', form.setError, onSaved);
  const { errors } = form.formState;

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
      <FormField label={t('fields.fullName')} error={fieldError(errors.fullName)} required>
        {(field) => <Input {...field} {...form.register('fullName')} autoComplete="name" />}
      </FormField>

      <FormField label={t('fields.phone')} hint={t('fields.phoneHint')} error={fieldError(errors.phone)}>
        {(field) => (
          <Input {...field} {...form.register('phone')} type="tel" inputMode="tel" autoComplete="tel" />
        )}
      </FormField>

      <FormField label={t('fields.province')} error={fieldError(errors.provinceCode)} required>
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

      <StepActions loading={save.isPending} />
    </form>
  );
}
