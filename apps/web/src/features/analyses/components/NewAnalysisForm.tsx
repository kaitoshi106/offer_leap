'use client';

import {
  type CreateAnalysis,
  type CreateAnalysisInput,
  createAnalysisSchema,
  JOB_DESCRIPTION_LIMITS,
  RESUME_FILE_TYPES,
  RESUME_MAX_BYTES,
} from '@offerleap/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button, Icon, Select, Skeleton, Textarea } from '@/components/atoms';
import { Alert, FileDropzone, FormField } from '@/components/molecules';
import { useResumes, useUploadResume } from '@/features/resumes/api/use-resumes';
import { useRouter } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useCreateAnalysis } from '../api/use-analyses';

const ACCEPT = [...Object.keys(RESUME_FILE_TYPES), ...Object.values(RESUME_FILE_TYPES), '.jpeg'];

/**
 * @description Starts an analysis: pick a CV (or upload one right here) and paste the job description. On
 * success it opens the analysis page, which shows progress until the AI is done.
 */
export function NewAnalysisForm() {
  const t = useTranslations('analyses.form');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const resumes = useResumes();
  const upload = useUploadResume();
  const create = useCreateAnalysis();
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  const form = useForm<CreateAnalysisInput, unknown, CreateAnalysis>({
    resolver: sharedSchemaResolver(createAnalysisSchema),
    defaultValues: { resumeId: '', jobDescription: '', locale },
  });
  const { errors } = form.formState;
  // useWatch (not form.watch) so the React Compiler can still optimise this component.
  const jobDescriptionLength = useWatch({ control: form.control, name: 'jobDescription' }).trim().length;
  const hasResumes = (resumes.data?.length ?? 0) > 0;

  // Preselect the newest CV once the list arrives.
  const newestId = resumes.data?.[0]?.id;
  useEffect(() => {
    if (newestId && !form.getValues('resumeId')) form.setValue('resumeId', newestId);
  }, [newestId, form]);

  function onFile(file: File) {
    setUploadError(undefined);
    upload.mutate(file, {
      onSuccess: (resume) => {
        form.setValue('resumeId', resume.id, { shouldValidate: true });
        setUploadMode(false);
      },
      onError: (error) => setUploadError(errorText(error)),
    });
  }

  function submit(values: CreateAnalysis) {
    // Feedback comes back in the language the user is reading.
    create.mutate(
      { ...values, locale },
      {
        onSuccess: (analysis) => router.push(`/analyses/${analysis.id}`),
        onError: (error) => {
          if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
        },
      },
    );
  }

  const createError = create.error && !(isApiError(create.error) && create.error.fieldErrors.length > 0);

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
      {createError && <Alert tone="danger">{errorText(create.error)}</Alert>}

      {resumes.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : uploadMode || !hasResumes ? (
        <div className="flex flex-col gap-2">
          {!hasResumes && <p className="text-sm text-fg-muted">{t('noResume')}</p>}
          {upload.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
              <Icon name="upload" size="sm" />
              {t('uploading')}
            </p>
          ) : (
            <FileDropzone
              title={t('dropTitle')}
              hint={t('dropHint')}
              accept={ACCEPT}
              maxBytes={RESUME_MAX_BYTES}
              onFile={onFile}
              onReject={(reason) =>
                setUploadError(
                  tErrors(reason === 'size' ? 'COMMON_FILE_TOO_LARGE' : 'COMMON_UNSUPPORTED_FILE_TYPE'),
                )
              }
              error={uploadError ?? fieldError(errors.resumeId)}
            />
          )}
          {hasResumes && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setUploadMode(false)}>
              {t('cancelUpload')}
            </Button>
          )}
        </div>
      ) : (
        <FormField label={t('resume')} error={fieldError(errors.resumeId)} required>
          {(field) => (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                {...field}
                {...form.register('resumeId')}
                placeholder={t('resumePlaceholder')}
                className="flex-1"
              >
                {resumes.data?.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {t('resumeOption', {
                      fileName: resume.fileName,
                      date: format.dateTime(new Date(resume.createdAt), { dateStyle: 'medium' }),
                    })}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                leftIcon={<Icon name="upload" size="sm" />}
                onClick={() => setUploadMode(true)}
              >
                {t('uploadNew')}
              </Button>
            </div>
          )}
        </FormField>
      )}

      <FormField
        label={t('jobDescription')}
        hint={t('jobDescriptionHint', {
          count: jobDescriptionLength,
          max: JOB_DESCRIPTION_LIMITS.max,
          min: JOB_DESCRIPTION_LIMITS.min,
        })}
        error={fieldError(errors.jobDescription)}
        required
      >
        {(field) => (
          <Textarea
            {...field}
            {...form.register('jobDescription')}
            rows={10}
            placeholder={t('jobDescriptionPlaceholder')}
          />
        )}
      </FormField>

      <Button
        type="submit"
        className="self-end"
        loading={create.isPending}
        disabled={upload.isPending}
        leftIcon={<Icon name="sparkles" size="sm" />}
      >
        {t('submit')}
      </Button>
    </form>
  );
}
