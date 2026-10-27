'use client';

import { RESUME_MAX_PER_USER, type ResumeSummary } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { Dialog } from '@/components/organisms';

export interface ReplaceOldestResumeDialogProps {
  /** The file being uploaded and the CV that would make room for it; null keeps the dialog closed. */
  pending: { fileName: string; oldest: ResumeSummary } | null;
  /** The upload with replacement is running. */
  loading: boolean;
  /** Why it failed (translated). */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * @description Shown when an upload hits the CV limit: asks whether to delete the oldest CV — and the analyses
 * made with it, said plainly since they can't be recovered — to make room for the new one.
 * @param props - {@link ReplaceOldestResumeDialogProps}
 */
export function ReplaceOldestResumeDialog({
  pending,
  loading,
  error,
  onConfirm,
  onCancel,
}: ReplaceOldestResumeDialogProps) {
  const t = useTranslations('resumeLimit');
  const tCommon = useTranslations('common');
  const format = useFormatter();

  return (
    <Dialog
      open={pending !== null}
      onClose={onCancel}
      title={t('title', { max: RESUME_MAX_PER_USER })}
      description={
        pending &&
        t('body', {
          fileName: pending.fileName,
          oldFileName: pending.oldest.fileName,
          date: format.dateTime(new Date(pending.oldest.createdAt), { dateStyle: 'medium' }),
          count: pending.oldest.analysisCount ?? 0,
        })
      }
      closeLabel={tCommon('close')}
      error={error}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {t('confirm')}
          </Button>
        </>
      }
    />
  );
}
