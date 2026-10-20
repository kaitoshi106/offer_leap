'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { Badge, Skeleton, Text } from '@/components/atoms';
import { Alert, ScoreGauge } from '@/components/molecules';
import { scoreBand } from '@/features/analyses/components/match';
import { Link } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useInterviews } from '../api/use-interviews';

/** Past mock interviews, newest first, linking to each one. */
export function InterviewHistory() {
  const t = useTranslations('interviews');
  const format = useFormatter();
  const errorText = useErrorText();
  const { data, error, isPending } = useInterviews();

  if (error) return <Alert tone="danger">{errorText(error)}</Alert>;
  if (isPending) return <Skeleton className="h-20 w-full" />;
  if (data.length === 0) return <Text tone="muted">{t('history.empty')}</Text>;

  return (
    <ul className="flex flex-col gap-3">
      {data.map((interview) => (
        <li key={interview.id}>
          <Link
            href={`/interviews/${interview.id}`}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {interview.overallScore !== null ? (
              <ScoreGauge
                size="sm"
                score={interview.overallScore}
                tone={scoreBand(interview.overallScore).tone}
                label={t('session.overall')}
                valueText={`${interview.overallScore}/100`}
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-fg-muted">
                {interview.answeredCount}/{interview.questionCount}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium text-fg">{interview.jobTitle}</span>
              <span className="truncate text-sm text-fg-muted">
                {t(`types.${interview.type}`)} ·{' '}
                {format.dateTime(new Date(interview.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </span>
            <Badge tone={interview.status === 'COMPLETED' ? 'success' : 'info'}>
              {interview.status === 'COMPLETED' ? t('history.completed') : t('history.inProgress')}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
