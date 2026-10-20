'use client';

import type { ApplicationDetail } from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button, Heading, Icon, Text, Textarea, VisuallyHidden } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { useErrorText } from '@/lib/api/use-error-text';

import { applicationsApi } from '../api/applications-api';
import { useSetCoverLetter, useUpdateApplication } from '../api/use-applications';

/**
 * @description Cover letter of an application: AI writes it live (the text appears as it is generated), then
 * the user edits, saves or copies it. Stopping keeps the partial text. Screen readers hear "writing…" and
 * "finished" instead of every new word.
 * @param props.application - Application being viewed.
 */
export function CoverLetterPanel({ application }: { application: ApplicationDetail }) {
  const t = useTranslations('applications.coverLetter');
  const locale = useLocale();
  const errorText = useErrorText();
  const toast = useToast();
  const update = useUpdateApplication(application.id);
  const setCoverLetter = useSetCoverLetter(application.id);
  const [draft, setDraft] = useState(application.coverLetter ?? '');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null);

  // Leaving the page stops the stream (the API then stops generating too).
  useEffect(() => () => controller.current?.abort(), []);

  const canGenerate = Boolean(application.jobDescription);

  async function generate() {
    controller.current = new AbortController();
    setStreaming(true);
    setError(undefined);
    setDraft('');
    setStatus(t('writing'));
    try {
      const letter = (
        await applicationsApi.coverLetter(application.id, locale, setDraft, controller.current.signal)
      ).trim();
      setDraft(letter);
      setCoverLetter(letter);
      setStatus(t('done'));
    } catch (generateError) {
      if (generateError instanceof DOMException && generateError.name === 'AbortError') return;
      setError(errorText(generateError));
      setStatus('');
    } finally {
      setStreaming(false);
      controller.current = null;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    toast.show({ tone: 'success', title: t('copied') });
  }

  return (
    <section
      aria-labelledby="cover-letter"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <VisuallyHidden role="status">{status}</VisuallyHidden>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level={2} size="sm" id="cover-letter" className="flex items-center gap-2">
            <Icon name="file-text" size="sm" className="text-ai-soft-fg" />
            {t('title')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('description')}
          </Text>
        </div>
        {streaming ? (
          <Button variant="outline" size="sm" onClick={() => controller.current?.abort()}>
            {t('stop')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={draft ? 'outline' : 'primary'}
            disabled={!canGenerate}
            leftIcon={<Icon name="sparkles" size="sm" />}
            onClick={generate}
          >
            {draft ? t('regenerate') : t('generate')}
          </Button>
        )}
      </div>

      {!canGenerate && <Alert tone="info">{t('needsJd')}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {streaming ? (
        <div
          aria-busy
          aria-label={t('label')}
          className="min-h-72 rounded-md border border-border bg-surface-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap"
        >
          {draft}
          <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ai align-text-bottom" />
          {!draft && <span className="text-fg-muted">{t('writing')}</span>}
        </div>
      ) : (
        (draft || application.coverLetter) && (
          <>
            <Textarea
              aria-label={t('label')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={14}
              className="leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={copy} disabled={!draft}>
                {t('copy')}
              </Button>
              <Button
                size="sm"
                loading={update.isPending}
                disabled={draft === (application.coverLetter ?? '')}
                onClick={() =>
                  update.mutate(
                    { coverLetter: draft },
                    { onSuccess: () => toast.show({ tone: 'success', title: t('saved') }) },
                  )
                }
              >
                {t('save')}
              </Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
