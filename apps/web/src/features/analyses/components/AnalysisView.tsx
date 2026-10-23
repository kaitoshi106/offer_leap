'use client';

import type { AnalysisDetail, AnalysisResult } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Badge, Button, Heading, Icon, Skeleton, Spinner, Text } from '@/components/atoms';
import { Alert, ScoreGauge } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { ApplicationFormDialog } from '@/features/applications/components/ApplicationFormDialog';
import { Link, useRouter } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAnalysis, useCreateAnalysis, useDeleteAnalysis } from '../api/use-analyses';
import { scoreBand } from './match';

/**
 * @description An analysis page: progress while the AI works (polling), the result once done, or the error with
 * a retry that re-runs the same CV and job description.
 * @param props.id - Analysis id from the URL.
 */
export function AnalysisView({ id }: { id: string }) {
  const t = useTranslations('analyses');
  const errorText = useErrorText();
  const { data: analysis, error, isPending } = useAnalysis(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/analyses"
        className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Icon name="arrow-right" size="sm" className="rotate-180" />
        {t('result.back')}
      </Link>

      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending && (
        <div aria-busy className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {analysis && <AnalysisBody analysis={analysis} />}
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: AnalysisDetail }) {
  const t = useTranslations('analyses');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const retry = useCreateAnalysis();

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={1} size="lg">
          {analysis.jobTitle ?? t('title')}
          {analysis.company && <span className="text-fg-muted"> · {analysis.company}</span>}
        </Heading>
        <Text size="sm" tone="muted">
          {t('result.resume', { fileName: analysis.resumeFileName })} ·{' '}
          {format.dateTime(new Date(analysis.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        {analysis.status === 'COMPLETED' && <SaveToBoard analysis={analysis} />}
        <DeleteAnalysis id={analysis.id} />
      </div>
    </div>
  );

  if (analysis.status === 'FAILED') {
    return (
      <>
        {header}
        <Alert tone="danger" title={t('status.failedTitle')}>
          {analysis.errorCode && tErrors.has(analysis.errorCode)
            ? tErrors(analysis.errorCode)
            : tErrors('COMMON_INTERNAL_ERROR')}
        </Alert>
        <Button
          className="self-start"
          loading={retry.isPending}
          onClick={() =>
            retry.mutate(
              {
                resumeId: analysis.resumeId,
                jobDescription: analysis.jobDescription,
                locale: analysis.locale,
              },
              { onSuccess: (next) => router.replace(`/analyses/${next.id}`) },
            )
          }
        >
          {t('status.retry')}
        </Button>
        <JobDescription text={analysis.jobDescription} />
      </>
    );
  }

  if (!analysis.result) {
    return (
      <>
        {header}
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-ai-soft/40 px-6 py-12 text-center"
        >
          <Spinner size="lg" label={null} className="text-ai-soft-fg" />
          <p className="font-medium text-fg">{t('status.processingTitle')}</p>
          <Text size="sm" tone="muted" className="max-w-sm">
            {t('status.processingBody')}
          </Text>
        </div>
        <JobDescription text={analysis.jobDescription} />
      </>
    );
  }

  return (
    <>
      {header}
      <Result result={analysis.result} />
      <JobDescription text={analysis.jobDescription} />
    </>
  );
}

function Result({ result }: { result: AnalysisResult }) {
  const t = useTranslations('analyses.result');
  const { level, tone } = scoreBand(result.score);
  const levelText = t(`levels.${level}`);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <ScoreGauge
              score={result.score}
              tone={tone}
              label={t('score')}
              valueText={`${t('scoreValue', { score: result.score })}, ${levelText}`}
            />
            <Badge tone={tone}>{levelText}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <Heading level={2} size="sm">
              {t('summary')}
            </Heading>
            <Text className="leading-relaxed">{result.summary}</Text>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t('matchedSkills')}>
          <TagList empty={t('none')}>
            {result.matchedSkills.map((skill) => (
              <li key={skill}>
                <Badge tone="success" icon={<Icon name="check" size="xs" />}>
                  {skill}
                </Badge>
              </li>
            ))}
          </TagList>
        </Card>
        <Card title={t('missingSkills')}>
          <TagList empty={t('none')}>
            {result.missingSkills.map((skill) => (
              <li key={skill.name}>
                <Badge tone={skill.importance === 'REQUIRED' ? 'danger' : 'warning'}>
                  {skill.name} · {t(skill.importance === 'REQUIRED' ? 'required' : 'niceToHave')}
                </Badge>
              </li>
            ))}
          </TagList>
        </Card>
        <Card title={t('strengths')}>
          <BulletList items={result.strengths} empty={t('none')} />
        </Card>
        <Card title={t('gaps')}>
          <BulletList items={result.gaps} empty={t('none')} />
        </Card>
      </div>

      {result.sources && result.sources.length > 0 && (
        <Card title={t('sources')} icon="sparkles">
          <Text size="sm" tone="muted">
            {t('sourcesDescription')}
          </Text>
          <ul className="flex flex-col gap-2">
            {result.sources.map((source, index) => (
              <li
                key={`${source.documentId}-${index}`}
                className="rounded-lg bg-surface-muted/60 p-3 text-sm"
              >
                <span className="font-medium text-fg">{source.title}</span>
                <p className="mt-1 leading-relaxed text-fg-muted">{source.excerpt}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t('suggestions')} icon="sparkles">
        {result.suggestions.length === 0 ? (
          <Text tone="muted">{t('none')}</Text>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-primary-text">
            {result.suggestions.map((suggestion) => (
              <li key={suggestion} className="leading-relaxed">
                {suggestion}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title?: string; icon?: 'sparkles'; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6">
      {title && (
        <Heading level={2} size="sm" className="flex items-center gap-2">
          {icon && <Icon name={icon} size="sm" className="text-ai-soft-fg" />}
          {title}
        </Heading>
      )}
      {children}
    </section>
  );
}

function TagList({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <Text tone="muted">{empty}</Text>;
  return <ul className="flex flex-wrap gap-2">{children}</ul>;
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <Text tone="muted">{empty}</Text>;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-fg-subtle">
      {items.map((item) => (
        <li key={item} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

function JobDescription({ text }: { text: string }) {
  const t = useTranslations('analyses.result');
  return (
    <details className="group rounded-xl border border-border bg-surface p-5">
      <summary className="flex cursor-pointer items-center justify-between font-medium text-fg">
        {t('jobDescription')}
        <Icon name="chevron-down" size="sm" className="transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm whitespace-pre-line text-fg-muted">{text}</p>
    </details>
  );
}

function DeleteAnalysis({ id }: { id: string }) {
  const t = useTranslations('analyses.result');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const remove = useDeleteAnalysis();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t('delete')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        closeLabel={tCommon('close')}
        error={remove.error ? errorText(remove.error) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(id, {
                  onSuccess: () => {
                    toast.show({ tone: 'success', title: t('deleted') });
                    router.replace('/analyses');
                  },
                })
              }
            >
              {t('delete')}
            </Button>
          </>
        }
      />
    </>
  );
}

/** Turns a finished analysis into a tracked application (the API copies the job description and links the score). */
function SaveToBoard({ analysis }: { analysis: AnalysisDetail }) {
  const t = useTranslations('analyses.result');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Icon name="file-text" size="sm" />}
        onClick={() => setOpen(true)}
      >
        {t('saveToBoard')}
      </Button>
      <ApplicationFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(application) => router.push(`/applications/${application.id}`)}
        defaults={{
          company: analysis.company ?? '',
          jobTitle: analysis.jobTitle ?? '',
          analysisId: analysis.id,
        }}
      />
    </>
  );
}
