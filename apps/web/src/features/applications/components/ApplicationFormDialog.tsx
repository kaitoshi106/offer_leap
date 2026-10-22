'use client';

import {
  APPLICATION_STATUSES,
  type ApplicationDetail,
  type CreateApplication,
  type CreateApplicationInput,
  createApplicationSchema,
} from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Button, Input, Select, Textarea } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { Dialog } from '@/components/organisms';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useCreateApplication } from '../api/use-applications';

export interface ApplicationFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (application: ApplicationDetail) => void;
  /** Prefill, e.g. from an analysis (its job description is copied by the API, so the field is hidden). */
  defaults?: Partial<Pick<CreateApplicationInput, 'company' | 'jobTitle' | 'analysisId'>>;
}

/**
 * @description "Add application" dialog. Mounted only while open, so every opening starts with a fresh form.
 * @param props - {@link ApplicationFormDialogProps}
 */
export function ApplicationFormDialog(props: ApplicationFormDialogProps) {
  const t = useTranslations('applications.form');
  const tCommon = useTranslations('common');
  return (
    <Dialog open={props.open} onClose={props.onClose} title={t('createTitle')} closeLabel={tCommon('close')}>
      {props.open && <CreateForm {...props} />}
    </Dialog>
  );
}

function CreateForm({ onClose, onCreated, defaults }: ApplicationFormDialogProps) {
  const t = useTranslations('applications');
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const create = useCreateApplication();
  const form = useForm<CreateApplicationInput, unknown, CreateApplication>({
    resolver: sharedSchemaResolver(createApplicationSchema),
    defaultValues: {
      company: '',
      jobTitle: '',
      jobUrl: '',
      jobDescription: '',
      status: 'SAVED',
      ...defaults,
    },
  });
  const { errors } = form.formState;
  const fromAnalysis = Boolean(defaults?.analysisId);

  function submit(values: CreateApplication) {
    create.mutate(values, {
      onSuccess: onCreated,
      onError: (error) => {
        if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
      },
    });
  }

  const generalError = create.error && !(isApiError(create.error) && create.error.fieldErrors.length > 0);

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      {generalError && <Alert tone="danger">{errorText(create.error)}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('form.company')} error={fieldError(errors.company)} required>
          {(field) => <Input {...field} {...form.register('company')} autoComplete="organization" />}
        </FormField>
        <FormField label={t('form.jobTitle')} error={fieldError(errors.jobTitle)} required>
          {(field) => <Input {...field} {...form.register('jobTitle')} autoComplete="organization-title" />}
        </FormField>
      </div>
      <FormField label={t('form.jobUrl')} hint={t('form.jobUrlHint')} error={fieldError(errors.jobUrl)}>
        {(field) => <Input {...field} {...form.register('jobUrl')} type="url" inputMode="url" />}
      </FormField>
      {!fromAnalysis && (
        <FormField
          label={t('form.jobDescription')}
          hint={t('form.jobDescriptionHint')}
          error={fieldError(errors.jobDescription)}
        >
          {(field) => <Textarea {...field} {...form.register('jobDescription')} rows={5} />}
        </FormField>
      )}
      <FormField label={t('form.status')} error={fieldError(errors.status)}>
        {(field) => (
          <Select {...field} {...form.register('status')}>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {t('form.create')}
        </Button>
      </div>
    </form>
  );
}
