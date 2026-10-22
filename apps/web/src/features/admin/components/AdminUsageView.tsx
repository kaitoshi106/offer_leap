'use client';

import { AI_USAGE_PERIODS, type AiUsageStats } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Avatar, Heading, Select, Skeleton, Text } from '@/components/atoms';
import { Alert, BarChart } from '@/components/molecules';
import { Link } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAiUsage } from '../api/use-admin';

/** Prompt id → translation key of the feature it belongs to. */
const TASK_KEYS: Record<string, 'resume' | 'match' | 'letter' | 'questions' | 'feedback' | 'summary'> = {
  'resume-extraction': 'resume',
  'job-match': 'match',
  'cover-letter': 'letter',
  'interview-questions': 'questions',
  'interview-feedback': 'feedback',
  'interview-summary': 'summary',
};

/** `job-match.v1` → feature name + version, unknown tasks shown as they are. */
function useTaskLabel() {
  const t = useTranslations('admin.usage.tasks');
  return (task: string) => {
    const [name, version] = task.split('.');
    const key = TASK_KEYS[name!];
    return key ? `${t(key)} (${version})` : task;
  };
}

/** Admin overview: AI calls, failures, tokens and latency over a period, per day, per feature and per user. */
export function AdminUsageView() {
  const t = useTranslations('admin.usage');
  const errorText = useErrorText();
  const [days, setDays] = useState<number>(30);
  const { data, error, isPending } = useAiUsage(days);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2} size="md">
          {t('title')}
        </Heading>
        <Select
          aria-label={t('period')}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          wrapperClassName="w-44"
        >
          {AI_USAGE_PERIODS.map((period) => (
            <option key={period} value={period}>
              {t('days', { days: period })}
            </option>
          ))}
        </Select>
      </div>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending ? <Skeleton className="h-96 w-full" /> : data && <Usage stats={data} />}
    </div>
  );
}

function Usage({ stats }: { stats: AiUsageStats }) {
  const t = useTranslations('admin.usage');
  const format = useFormatter();
  const taskLabel = useTaskLabel();
  const { totals } = stats;
  const number = (value: number) => format.number(value);
  const failureRate = totals.calls ? totals.failures / totals.calls : 0;
  const peak = stats.byDay.reduce((best, day) => (day.calls > best.calls ? day : best), stats.byDay[0]!);
  const shortDate = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7);

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('cards.calls')} value={number(totals.calls)} />
        <Stat
          label={t('cards.failureRate')}
          value={format.number(failureRate, { style: 'percent', maximumFractionDigits: 1 })}
        />
        <Stat
          label={t('cards.tokens')}
          value={number(totals.inputTokens + totals.outputTokens)}
          detail={t('tokensDetail', {
            input: number(totals.inputTokens),
            output: number(totals.outputTokens),
          })}
        />
        <Stat
          label={t('cards.latency')}
          value={t('latencyValue', {
            seconds: format.number(totals.avgLatencyMs / 1000, { maximumFractionDigits: 1 }),
          })}
        />
      </dl>

      <Card title={t('chart')}>
        {totals.calls === 0 ? (
          <Text tone="muted">{t('noData')}</Text>
        ) : (
          <BarChart
            title={t('chart')}
            summary={t('chartSummary', {
              total: totals.calls,
              days: stats.days,
              max: peak.calls,
              date: shortDate(peak.date),
            })}
            columns={[t('task'), t('calls'), t('chartFailures')]}
            data={stats.byDay.map((day) => ({
              label: shortDate(day.date),
              value: day.calls,
              highlight: day.failures,
            }))}
          />
        )}
        <Text size="xs" tone="muted">
          {t('defaultQuota', { quota: stats.defaultQuota })}
        </Text>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t('byTask')}>
          {stats.byTask.length === 0 ? (
            <Text tone="muted">{t('noData')}</Text>
          ) : (
            // Scrolls sideways on phones; focusable and named so keyboard users can scroll it too.
            <div
              tabIndex={0}
              role="region"
              aria-label={t('byTask')}
              className="overflow-x-auto rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <table className="w-full min-w-[26rem] text-left text-sm">
                <thead className="text-xs text-fg-muted uppercase">
                  <tr>
                    <th scope="col" className="py-2 font-medium">
                      {t('task')}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t('calls')}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t('failures')}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t('tokens')}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t('latency')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {stats.byTask.map((row) => (
                    <tr key={row.task}>
                      <th scope="row" className="py-2 pr-3 font-medium text-fg">
                        {taskLabel(row.task)}
                      </th>
                      <td className="py-2 text-right">{number(row.calls)}</td>
                      <td className="py-2 text-right">{number(row.failures)}</td>
                      <td className="py-2 text-right">{number(row.inputTokens + row.outputTokens)}</td>
                      <td className="py-2 text-right">
                        {t('latencyValue', {
                          seconds: format.number(row.avgLatencyMs / 1000, { maximumFractionDigits: 1 }),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={t('topUsers')}>
          {stats.topUsers.length === 0 ? (
            <Text tone="muted">{t('noData')}</Text>
          ) : (
            <ol className="flex flex-col gap-3">
              {stats.topUsers.map((user) => (
                <li key={user.userId} className="flex items-center gap-3">
                  <Avatar name={user.fullName} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/admin/users/${user.userId}`}
                      className="truncate text-sm font-medium text-fg hover:text-primary-text hover:underline"
                    >
                      {user.fullName}
                    </Link>
                    <span className="truncate text-xs text-fg-muted">{user.email}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{number(user.calls)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-card">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-fg-muted">{detail}</dd>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <Heading level={3} size="sm">
        {title}
      </Heading>
      {children}
    </section>
  );
}
