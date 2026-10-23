'use client';

import {
  RESUME_FILE_TYPES,
  RESUME_MAX_BYTES,
  type ResumeStatus,
  type ResumeSummary,
} from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Badge, Button, Heading, Icon, Skeleton, Spinner, Text } from '@/components/atoms';
import { Alert, FileDropzone } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { CareerStep } from '@/features/onboarding/components/CareerStep';
import { PersonalStep } from '@/features/onboarding/components/PersonalStep';
import { PreferencesStep } from '@/features/onboarding/components/PreferencesStep';
import { useDeleteResume, useResumes, useUploadResume } from '@/features/resumes/api/use-resumes';
import { useErrorText } from '@/lib/api/use-error-text';

import { useProfile } from '../api/use-profile';

const ACCEPT = [...Object.keys(RESUME_FILE_TYPES), ...Object.values(RESUME_FILE_TYPES), '.jpeg'];
const STATUS_TONE: Record<ResumeStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
};

/**
 * @description `/profile`: edit the profile after onboarding — the same three forms as the wizard, each saving
 * its own section — and manage uploaded CVs.
 */
export function ProfileView() {
  const t = useTranslations('profile');
  const tSteps = useTranslations('onboarding.stepTitles');
  const toast = useToast();
  const errorText = useErrorText();
  const { data: profile, error, isPending } = useProfile();
  const saved = () => toast.show({ tone: 'success', title: t('saved') });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="lg">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('description')}</Text>
      </div>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {profile && (
            <>
              {/* Each form follows the saved profile (saving one section refreshes all three) without losing
                  what is being typed in the others. */}
              <Section id="profile-personal" title={tSteps('personal')}>
                <PersonalStep mode="profile" values={profile} onSaved={saved} />
              </Section>
              <Section id="profile-career" title={tSteps('career')}>
                <CareerStep mode="profile" values={profile} onSaved={saved} />
              </Section>
              <Section id="profile-preferences" title={tSteps('preferences')}>
                <PreferencesStep mode="profile" values={profile} onSaved={saved} />
              </Section>
            </>
          )}
          {/* After the forms, not before them: rendered earlier it would jump down when they arrive. Shown even
              when the profile failed to load — CVs don't depend on it. */}
          <Section id="profile-cvs" title={t('cvs.title')} description={t('cvs.description')}>
            <ResumeManager />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <Heading level={2} size="sm" id={id}>
          {title}
        </Heading>
        {description && (
          <Text size="sm" tone="muted">
            {description}
          </Text>
        )}
      </div>
      {children}
    </section>
  );
}

function ResumeManager() {
  const t = useTranslations('profile.cvs');
  const tResume = useTranslations('onboarding.resume');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const toast = useToast();
  const errorText = useErrorText();
  const { data, error, isPending } = useResumes();
  const upload = useUploadResume();
  const [uploadError, setUploadError] = useState<string>();
  const [deleting, setDeleting] = useState<ResumeSummary | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : data?.length === 0 ? (
        <Text tone="muted">{t('empty')}</Text>
      ) : (
        <ul className="flex flex-col gap-3">
          {data?.map((resume) => (
            <li
              key={resume.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
            >
              <Icon name="file-text" size="sm" className="text-fg-muted" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-fg">{resume.fileName}</span>
                <span className="text-xs text-fg-muted">
                  {t('meta', {
                    date: format.dateTime(new Date(resume.createdAt), { dateStyle: 'medium' }),
                    count: resume.analysisCount ?? 0,
                  })}
                </span>
              </div>
              <Badge tone={STATUS_TONE[resume.status]}>{t(`statuses.${resume.status}`)}</Badge>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t('delete')} ${resume.fileName}`}
                onClick={() => setDeleting(resume)}
              >
                {t('delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {upload.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner size="sm" label={null} />
          {t('upload')}
        </p>
      ) : (
        <FileDropzone
          title={tResume('dropTitle')}
          hint={tResume('dropHint')}
          accept={ACCEPT}
          maxBytes={RESUME_MAX_BYTES}
          onFile={(file) => {
            setUploadError(undefined);
            upload.mutate(file, {
              onSuccess: () => toast.show({ tone: 'success', title: t('uploaded') }),
              onError: (uploadFailure) => setUploadError(errorText(uploadFailure)),
            });
          }}
          onReject={(reason) =>
            setUploadError(
              tErrors(reason === 'size' ? 'COMMON_FILE_TOO_LARGE' : 'COMMON_UNSUPPORTED_FILE_TYPE'),
            )
          }
          error={uploadError}
        />
      )}
      <DeleteResumeDialog resume={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function DeleteResumeDialog({ resume, onClose }: { resume: ResumeSummary | null; onClose: () => void }) {
  const t = useTranslations('profile.cvs');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const errorText = useErrorText();
  const remove = useDeleteResume();
  return (
    <Dialog
      open={resume !== null}
      onClose={onClose}
      title={resume ? t('deleteTitle', { fileName: resume.fileName }) : ''}
      description={resume ? t('deleteBody', { count: resume.analysisCount ?? 0 }) : undefined}
      closeLabel={tCommon('close')}
      error={remove.error && remove.variables === resume?.id ? errorText(remove.error) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              resume &&
              remove.mutate(resume.id, {
                onSuccess: () => {
                  toast.show({ tone: 'success', title: t('deleted') });
                  onClose();
                },
              })
            }
          >
            {t('delete')}
          </Button>
        </>
      }
    />
  );
}
