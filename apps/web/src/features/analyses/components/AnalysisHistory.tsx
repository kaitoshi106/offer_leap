'use client';

import { type AnalysisSummary, DEFAULT_PAGE_SIZE, type PageQuery } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';

import { Badge, Skeleton, Spinner, Text } from '@/components/atoms';
import { Alert, ScoreGauge } from '@/components/molecules';
import { Link } from '@/i18n/navigation';
import { ListPagination } from '@/features/pagination/ListPagination';
import { usePageParams } from '@/features/pagination/use-page-params';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAnalyses } from '../api/use-analyses';
import { scoreBand } from './match';

/**
 * @description Past analyses as links to their result, newest first: paginated (page and size in the URL), or just
 * the latest few.
 * @param props.limit - Show only the latest N, without paging (the dashboard).
 */
export function AnalysisHistory({ limit }: { limit?: number }) {
  return limit ? (
    <HistoryPage query={{ page: 1, pageSize: DEFAULT_PAGE_SIZE }} limit={limit} />
  ) : (
    <PagedHistory />
  );
}

function PagedHistory() {
  const { page, pageSize, setPage, setPageSize } = usePageParams();
  return <HistoryPage query={{ page, pageSize }} onPageChange={setPage} onPageSizeChange={setPageSize} />;
}

function HistoryPage({
  query,
  limit,
  onPageChange,
  onPageSizeChange,
}: {
  query: PageQuery;
  limit?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const t = useTranslations('analyses');
  const errorText = useErrorText();
  const { data, error, isPending, isPlaceholderData } = useAnalyses(query);

  if (error) return <Alert tone="danger">{errorText(error)}</Alert>;
  if (isPending) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (data.total === 0) return <Text tone="muted">{t('history.empty')}</Text>;

  return (
    <div className="flex flex-col gap-4">
      <ul aria-busy={isPlaceholderData} className="flex flex-col gap-3">
        {data.items.slice(0, limit).map((analysis) => (
          <li key={analysis.id}>
            <HistoryItem analysis={analysis} />
          </li>
        ))}
      </ul>
      {onPageChange && onPageSizeChange && (
        <ListPagination
          data={data}
          label={t('history.pages')}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
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
