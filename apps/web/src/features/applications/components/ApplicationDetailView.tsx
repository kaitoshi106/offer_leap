'use client';

import {
  APPLICATION_STATUSES,
  type ApplicationDetail,
  type ApplicationStatus,
  type UpdateApplication,
  type UpdateApplicationInput,
  updateApplicationSchema,
} from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Heading, Icon, Input, Select, Skeleton, Textarea } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { Link, useRouter } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import {
  useApplication,
  useDeleteApplication,
  useMoveApplication,
  useUpdateApplication,
} from '../api/use-applications';
import { positionBetween } from '../board';
import { CoverLetterPanel } from './CoverLetterPanel';

/**
 * @description One application: editable details and notes, its column, and the cover letter panel.
 * @param props.id - Application id from the URL.
 */
export function ApplicationDetailView({ id }: { id: string }) {
  const t = useTranslations('applications');
  const errorText = useErrorText();
  const { data: application, error, isPending } = useApplication(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Icon name="arrow-right" size="sm" className="rotate-180" />
        {t('detail.back')}
      </Link>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending && <Skeleton className="h-96 w-full" />}
      {application && (
        <>
          <Header application={application} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* Remount when the saved data changes so the form starts from it. */}
            <DetailsForm key={application.updatedAt} application={application} />
            <CoverLetterPanel key={application.id} application={application} />
          </div>
        </>
      )}
    </div>
  );
}

function Header({ application }: { application: ApplicationDetail }) {
  const t = useTranslations('applications');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const move = useMoveApplication();
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Heading level={1} size="lg">
          {application.jobTitle} <span className="text-fg-muted">· {application.company}</span>
        </Heading>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {application.jobUrl && (
            <a
              href={application.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary-text hover:underline"
            >
              {t('detail.openJob')}
              <Icon name="arrow-right" size="xs" className="-rotate-45" />
            </a>
          )}
          <Link
            href={`/interviews?applicationId=${application.id}`}
            className="inline-flex items-center gap-1 font-medium text-primary-text hover:underline"
          >
            <Icon name="message-square" size="xs" />
            {t('detail.practice')}
          </Link>
          {application.analysisId && application.score !== null && (
            <Link
              href={`/analyses/${application.analysisId}`}
              className="inline-flex items-center gap-1 font-medium text-primary-text hover:underline"
            >
              <Icon name="target" size="xs" />
              {t('detail.analysis', { score: application.score })}
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          aria-label={t('form.status')}
          value={application.status}
          onChange={(event) =>
            // Top of the new column, like a freshly moved card.
            move.mutate({
              id: application.id,
              status: event.target.value as ApplicationStatus,
              position: positionBetween(undefined, application.position),
            })
          }
          className="h-9"
          wrapperClassName="w-40"
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {t('detail.delete')}
        </Button>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('detail.deleteTitle')}
        description={t('detail.deleteBody')}
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(application.id, {
                  onSuccess: () => {
                    toast.show({ tone: 'success', title: t('detail.deleted') });
                    router.replace('/applications');
                  },
                })
              }
            >
              {t('detail.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function DetailsForm({ application }: { application: ApplicationDetail }) {
  const t = useTranslations('applications');
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const update = useUpdateApplication(application.id);
  const form = useForm<UpdateApplicationInput, unknown, UpdateApplication>({
    resolver: sharedSchemaResolver(updateApplicationSchema),
    defaultValues: {
      company: application.company,
      jobTitle: application.jobTitle,
      jobUrl: application.jobUrl ?? '',
      jobDescription: application.jobDescription ?? '',
      notes: application.notes ?? '',
    },
  });
  const { errors, isDirty } = form.formState;

  function submit(values: UpdateApplication) {
    update.mutate(values, {
      onSuccess: () => toast.show({ tone: 'success', title: t('form.saved') }),
      onError: (error) => {
        if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
      },
    });
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit)}
      aria-labelledby="application-details"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <Heading level={2} size="sm" id="application-details">
        {t('detail.details')}
      </Heading>
      {update.error && !(isApiError(update.error) && update.error.fieldErrors.length > 0) && (
        <Alert tone="danger">{errorText(update.error)}</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('form.company')} error={fieldError(errors.company)} required>
          {(field) => <Input {...field} {...form.register('company')} />}
        </FormField>
        <FormField label={t('form.jobTitle')} error={fieldError(errors.jobTitle)} required>
          {(field) => <Input {...field} {...form.register('jobTitle')} />}
        </FormField>
      </div>
      <FormField label={t('form.jobUrl')} hint={t('form.jobUrlHint')} error={fieldError(errors.jobUrl)}>
        {(field) => <Input {...field} {...form.register('jobUrl')} type="url" inputMode="url" />}
      </FormField>
      <FormField
        label={t('form.jobDescription')}
        hint={t('form.jobDescriptionHint')}
        error={fieldError(errors.jobDescription)}
      >
        {(field) => <Textarea {...field} {...form.register('jobDescription')} rows={6} />}
      </FormField>
      <FormField label={t('form.notes')} error={fieldError(errors.notes)}>
        {(field) => (
          <Textarea
            {...field}
            {...form.register('notes')}
            rows={4}
            placeholder={t('form.notesPlaceholder')}
          />
        )}
      </FormField>
      <Button type="submit" className="self-end" loading={update.isPending} disabled={!isDirty}>
        {t('form.save')}
      </Button>
    </form>
  );
}
