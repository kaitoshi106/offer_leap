'use client';

import {
  CAREER_LEVELS,
  type CareerStep as CareerValues,
  type CareerStepInput,
  careerStepSchema,
  PROFILE_LIMITS,
  type ProfileValues,
} from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { Input, Select } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { Combobox, TagInput } from '@/components/organisms';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useTaxonomies } from '../api/use-onboarding';
import { toOptions } from './options';
import { StepActions } from './StepActions';
import { useSuggestionProps } from './SuggestionBadge';
import type { SuggestedFields } from './suggestions';
import { useStepSave } from './use-step-save';

/** Empty number inputs become `undefined` so the schema reports "required" instead of `NaN`. */
const toNumber = (value: unknown) => (value === '' || value == null ? undefined : Number(value));

/** Step 2: industry, title, level, experience and skills. */
export function CareerStep({
  values,
  suggested = {},
  onSaved,
  onBack,
}: {
  values: ProfileValues;
  /** Fields pre-filled from the CV. */
  suggested?: SuggestedFields;
  onSaved: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('onboarding');
  const suggestion = useSuggestionProps();
  const locale = useLocale();
  const fieldError = useFieldErrorText();
  const { industries } = useTaxonomies();
  const form = useForm<CareerStepInput, unknown, CareerValues>({
    resolver: sharedSchemaResolver(careerStepSchema),
    defaultValues: {
      industryCode: values.industryCode ?? '',
      jobTitle: values.jobTitle ?? '',
      level: values.level ?? undefined,
      yearsOfExperience: values.yearsOfExperience ?? undefined,
      skills: values.skills,
    },
  });
  const { submit, save } = useStepSave('career', form.setError, onSaved);
  const { errors } = form.formState;

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
      <FormField
        label={t('fields.industry')}
        {...suggestion(suggested.industryCode)}
        error={fieldError(errors.industryCode)}
        required
      >
        {(field) => (
          <Controller
            control={form.control}
            name="industryCode"
            render={({ field: control }) => (
              <Combobox
                {...field}
                ref={control.ref}
                options={toOptions(industries.data, locale)}
                value={control.value || null}
                onChange={(code) => control.onChange(code ?? '')}
                onBlur={control.onBlur}
                placeholder={t('fields.industryPlaceholder')}
                noResultsLabel={t('noResults')}
              />
            )}
          />
        )}
      </FormField>

      <FormField
        label={t('fields.jobTitle')}
        {...suggestion(suggested.jobTitle)}
        error={fieldError(errors.jobTitle)}
        required
      >
        {(field) => (
          <Input {...field} {...form.register('jobTitle')} placeholder={t('fields.jobTitlePlaceholder')} />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t('fields.level')}
          {...suggestion(suggested.level)}
          error={fieldError(errors.level)}
          required
        >
          {(field) => (
            <Select
              {...field}
              {...form.register('level')}
              defaultValue={values.level ?? ''}
              placeholder={t('fields.levelPlaceholder')}
            >
              {CAREER_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`levels.${level}`)}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label={t('fields.years')}
          {...suggestion(suggested.yearsOfExperience)}
          error={fieldError(errors.yearsOfExperience)}
          required
        >
          {(field) => (
            <Input
              {...field}
              {...form.register('yearsOfExperience', { setValueAs: toNumber })}
              type="number"
              inputMode="numeric"
              min={0}
              max={PROFILE_LIMITS.yearsMax}
            />
          )}
        </FormField>
      </div>

      <FormField
        label={t('fields.skills')}
        {...suggestion(suggested.skills, t('fields.skillsHint'))}
        error={fieldError(errors.skills)}
        required
      >
        {(field) => (
          <Controller
            control={form.control}
            name="skills"
            render={({ field: control }) => (
              <TagInput
                {...field}
                ref={control.ref}
                value={control.value}
                onChange={control.onChange}
                onBlur={control.onBlur}
                maxTags={PROFILE_LIMITS.skillsMax}
                placeholder={t('fields.skillsPlaceholder')}
                removeLabel={(skill) => t('fields.removeSkill', { skill })}
              />
            )}
          />
        )}
      </FormField>

      <StepActions onBack={onBack} loading={save.isPending} />
    </form>
  );
}
