'use client';

import { RESUME_FILE_TYPES, RESUME_MAX_BYTES, type ResumeSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button, Icon, Spinner, Text } from '@/components/atoms';
import { Alert, FileDropzone, type FileRejection } from '@/components/molecules';
import { isResumeFinal, useResumePolling } from '@/features/resumes/api/use-resumes';
import { useResumeUploader } from '@/features/resumes/components/use-resume-uploader';
import { useErrorText } from '@/lib/api/use-error-text';

import { useSaveOnboardingStep } from '../api/use-onboarding';

/** Both MIME types and extensions: some systems report an empty type for DOCX. */
const ACCEPT = [...Object.keys(RESUME_FILE_TYPES), ...Object.values(RESUME_FILE_TYPES), '.jpeg'];

/**
 * @description Optional first step: upload a CV, wait while the AI reads it (polling), then continue with the
 * next steps pre-filled. Every state offers a way forward without the AI (skip / fill in manually).
 * @param props.resume - Latest CV from the onboarding state.
 * @param props.suggestedCount - How many fields hold values read from the CV (shown once parsing is done).
 * @param props.onSaved - Go to the next step.
 */
export function ResumeStep({
  resume,
  suggestedCount,
  onSaved,
}: {
  resume: ResumeSummary | null;
  suggestedCount: number;
  onSaved: () => void;
}) {
  const t = useTranslations('onboarding');
  const tErrors = useTranslations('errors');
  const errorText = useErrorText();
  const upload = useResumeUploader();
  const save = useSaveOnboardingStep();
  const [error, setError] = useState<string>();
  const [replacing, setReplacing] = useState(false);
  useResumePolling(resume);

  const reading = upload.isPending || (resume !== null && !isResumeFinal(resume));
  const completed = resume?.status === 'COMPLETED' && !replacing;
  const failed = resume?.status === 'FAILED';

  function onFile(file: File) {
    setError(undefined);
    upload.mutate(file, {
      onSuccess: () => setReplacing(false),
      onError: (uploadError) => setError(errorText(uploadError)),
    });
  }

  function onReject(reason: FileRejection) {
    setError(tErrors(reason === 'size' ? 'COMMON_FILE_TOO_LARGE' : 'COMMON_UNSUPPORTED_FILE_TYPE'));
  }

  const next = () =>
    save.mutate(
      { step: 'resume', values: {} },
      { onSuccess: onSaved, onError: (saveError) => setError(errorText(saveError)) },
    );

  return (
    <div className="flex flex-col gap-6">
      <Text tone="muted">{t('resume.intro')}</Text>

      {reading && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-ai-soft/40 px-6 py-10 text-center"
        >
          <Spinner size="lg" label={null} className="text-ai-soft-fg" />
          <p className="font-medium text-fg">{t('resume.processingTitle')}</p>
          <Text size="sm" tone="muted" className="max-w-sm">
            {t('resume.processingBody')}
          </Text>
        </div>
      )}

      {!reading && completed && (
        <Alert tone="success" title={t('resume.doneTitle', { fileName: resume.fileName })}>
          {t('resume.doneBody', { count: suggestedCount })}
        </Alert>
      )}

      {!reading && failed && !error && resume.errorCode && (
        <Alert tone="danger" title={t('resume.failedTitle', { fileName: resume.fileName })}>
          {tErrors.has(resume.errorCode) ? tErrors(resume.errorCode) : tErrors('COMMON_INTERNAL_ERROR')}
        </Alert>
      )}

      {!reading && !completed && (
        <FileDropzone
          title={t('resume.dropTitle')}
          hint={t('resume.dropHint')}
          accept={ACCEPT}
          maxBytes={RESUME_MAX_BYTES}
          onFile={onFile}
          onReject={onReject}
          error={error}
        />
      )}

      <Text size="xs" tone="muted" className="flex items-center gap-1.5">
        <Icon name="info" size="xs" />
        {t('resume.privacy')}
      </Text>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
        {completed ? (
          <Button variant="ghost" onClick={() => setReplacing(true)} disabled={save.isPending}>
            {t('resume.uploadAnother')}
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant={completed ? 'primary' : 'outline'}
          onClick={next}
          loading={save.isPending}
          rightIcon={<Icon name="arrow-right" size="sm" />}
        >
          {completed ? t('actions.next') : t('resume.skip')}
        </Button>
      </div>
      {upload.replaceDialog}
    </div>
  );
}
