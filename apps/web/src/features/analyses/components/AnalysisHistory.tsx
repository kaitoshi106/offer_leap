'use client';

import type { AnalysisSummary } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';

import { Badge, Skeleton, Spinner, Text } from '@/components/atoms';
import { Alert, ScoreGauge } from '@/components/molecules';
import { Link } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAnalyses } from '../api/use-analyses';
import { scoreBand } from './match';

/**
 * @description Past analyses as links to their result, newest first.
 * @param props.limit - Show only the latest N (e.g. on the dashboard).
 */
export function AnalysisHistory({ limit }: { limit?: number }) {
  const t = useTranslations('analyses');
  const errorText = useErrorText();
  const { data, error, isPending } = useAnalyses();

  if (error) return <Alert tone="danger">{errorText(error)}</Alert>;
  if (isPending) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (data.length === 0) return <Text tone="muted">{t('history.empty')}</Text>;

  return (
    <ul className="flex flex-col gap-3">
      {data.slice(0, limit).map((analysis) => (
        <li key={analysis.id}>
          <HistoryItem analysis={analysis} />
        </li>
      ))}
    </ul>
  );
}

function HistoryItem({ analysis }: { analysis: AnalysisSummary }) {
  const t = useTranslations('analyses');
  const format = useFormatter();
  const done = analysis.status === 'COMPLETED' && analysis.score !== null;

  return (
    <Link
      href={`/analyses/${analysis.id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {done ? (
        <ScoreGauge
          size="sm"
          score={analysis.score!}
          tone={scoreBand(analysis.score!).tone}
          label={t('result.score')}
          valueText={`${t('result.scoreValue', { score: analysis.score! })}, ${t(`result.levels.${scoreBand(analysis.score!).level}`)}`}
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          {analysis.status === 'FAILED' ? '—' : <Spinner size="sm" label={null} />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-fg">
          {analysis.jobTitle ?? (analysis.status === 'FAILED' ? t('history.failed') : t('history.pending'))}
          {analysis.company && <span className="text-fg-muted"> · {analysis.company}</span>}
        </span>
        <span className="truncate text-sm text-fg-muted">
          {t('history.resume', { fileName: analysis.resumeFileName })} ·{' '}
          {format.dateTime(new Date(analysis.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </span>
      {analysis.status === 'FAILED' && <Badge tone="danger">{t('history.failed')}</Badge>}
    </Link>
  );
}
