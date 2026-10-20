'use client';

import {
  type CreateInterview,
  type CreateInterviewInput,
  createInterviewSchema,
  INTERVIEW_LIMITS,
  INTERVIEW_TYPES,
} from '@offerleap/shared';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button, Icon, Input, Radio, Select, Text, Textarea } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { useApplications } from '@/features/applications/api/use-applications';
import { useRouter } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useCreateInterview } from '../api/use-interviews';

const COUNTS = Array.from(
  { length: INTERVIEW_LIMITS.questionsMax - INTERVIEW_LIMITS.questionsMin + 1 },
  (_, index) => INTERVIEW_LIMITS.questionsMin + index,
);

/**
 * @description Starts a mock interview, for a saved application (`?applicationId=` preselects it) or any job
 * title. Creating waits for the AI to write the questions (a few seconds), then opens the interview.
 */
export function NewInterviewForm() {
  const t = useTranslations('interviews');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const applications = useApplications();
  const create = useCreateInterview();
  const form = useForm<CreateInterviewInput, unknown, CreateInterview>({
    resolver: sharedSchemaResolver(createInterviewSchema),
    defaultValues: {
      applicationId: searchParams.get('applicationId') ?? undefined,
      jobTitle: '',
      jobDescription: '',
      type: 'MIXED',
      questionCount: INTERVIEW_LIMITS.questionsDefault,
      locale,
    },
  });
  const { errors } = form.formState;
  const applicationId = useWatch({ control: form.control, name: 'applicationId' });
  const application = applications.data?.find((item) => item.id === applicationId);

  // Choosing a saved application fills in its job title.
  useEffect(() => {
    if (application)
      form.setValue('jobTitle', application.jobTitle, { shouldValidate: form.formState.isSubmitted });
  }, [application, form]);

  function submit(values: CreateInterview) {
    create.mutate(
      // The API copies the saved job description of an application.
      { ...values, locale, ...(values.applicationId && { jobDescription: null }) },
      {
        onSuccess: (interview) => router.push(`/interviews/${interview.id}`),
        onError: (error) => {
          if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
        },
      },
    );
  }

  const generalError = create.error && !(isApiError(create.error) && create.error.fieldErrors.length > 0);

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
      {generalError && <Alert tone="danger">{errorText(create.error)}</Alert>}

      {(applications.data?.length ?? 0) > 0 && (
        <FormField label={t('form.application')} error={fieldError(errors.applicationId)}>
          {(field) => (
            <Select
              {...field}
              {...form.register('applicationId', { setValueAs: (value) => value || undefined })}
            >
              <option value="">{t('form.applicationNone')}</option>
              {applications.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {t('form.applicationOption', { jobTitle: item.jobTitle, company: item.company })}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <FormField label={t('form.jobTitle')} error={fieldError(errors.jobTitle)} required>
        {(field) => (
          <Input
            {...field}
            {...form.register('jobTitle')}
            placeholder={t('form.jobTitlePlaceholder')}
            readOnly={Boolean(application)}
          />
        )}
      </FormField>

      {application ? (
        <Text size="sm" tone="muted" className="flex items-center gap-1.5">
          <Icon name="info" size="sm" />
          {t('form.jobDescriptionFromApplication')}
        </Text>
      ) : (
        <FormField
          label={t('form.jobDescription')}
          hint={t('form.jobDescriptionHint')}
          error={fieldError(errors.jobDescription)}
        >
          {(field) => <Textarea {...field} {...form.register('jobDescription')} rows={5} />}
        </FormField>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-fg">{t('form.type')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {INTERVIEW_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer gap-2 rounded-md border border-border-strong p-3 text-sm has-checked:border-primary has-checked:bg-primary-soft"
            >
              <Radio {...form.register('type')} value={type} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-fg">{t(`types.${type}`)}</span>
                <span className="text-xs text-fg-muted">{t(`typeHints.${type}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField label={t('form.questionCount')} error={fieldError(errors.questionCount)} className="sm:w-48">
        {(field) => (
          <Select {...field} {...form.register('questionCount', { valueAsNumber: true })}>
            {COUNTS.map((count) => (
              <option key={count} value={count}>
                {t('form.questionCountOption', { count })}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <div className="flex flex-col items-end gap-2">
        <Button type="submit" loading={create.isPending} leftIcon={<Icon name="message-square" size="sm" />}>
          {t('form.submit')}
        </Button>
        {create.isPending && (
          <Text role="status" size="sm" tone="muted">
            {t('form.preparing')}
          </Text>
        )}
      </div>
    </form>
  );
}
