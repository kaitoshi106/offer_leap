'use client';

import { useTranslations } from 'next-intl';

import { buttonClasses, Heading, Icon, Skeleton, Text } from '@/components/atoms';
import { AnalysisHistory } from '@/features/analyses/components/AnalysisHistory';
import { useAiQuota } from '@/features/ai/api/use-ai-quota';
import { AppShell } from '@/features/app-shell/AppShell';
import { useCurrentUser } from '@/features/auth/api/use-auth';
import { Link } from '@/i18n/navigation';

/** Signed-in home: greeting, a shortcut to analyse a job posting and the latest analyses. */
export function DashboardView() {
  const t = useTranslations('dashboard');
  const { data: user } = useCurrentUser();
  const { data: quota } = useAiQuota();

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          {user ? (
            <Heading level={1} size="lg">
              {t('greeting', { name: user.fullName })}
            </Heading>
          ) : (
            // About as long as the greeting it stands for (it fills most of a phone, a quarter of a desktop).
            <Skeleton className="h-8 w-1/2 sm:w-1/4" />
          )}
          <Text tone="muted">{t('subtitle')}</Text>
        </div>

        {/* Drawn right away with its fixed text; only the number waits for the API, so the page below doesn't move. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-fg">{t('quota')}</span>
          {quota ? (
            <span className="min-w-12 font-semibold text-primary-text tabular-nums">
              {quota.limit === null
                ? t('quotaUnlimited')
                : t('quotaValue', { used: quota.used, limit: quota.limit })}
            </span>
          ) : (
            <Skeleton className="h-5 w-12" />
          )}
          <span className="text-xs text-fg-muted">{t('quotaHint')}</span>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-linear-to-br from-primary-soft to-ai-soft p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Heading level={2} size="sm" className="flex items-center gap-2">
              <Icon name="target" size="sm" className="text-primary-text" />
              {t('ctaTitle')}
            </Heading>
            <Text size="sm" tone="muted" className="max-w-xl">
              {t('ctaBody')}
            </Text>
          </div>
          <Link href="/analyses" className={buttonClasses()}>
            {t('ctaAction')}
            <Icon name="arrow-right" size="sm" />
          </Link>
        </section>

        <section aria-labelledby="recent-analyses" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Heading level={2} size="sm" id="recent-analyses">
              {t('recent')}
            </Heading>
            <Link href="/analyses" className="text-sm font-medium text-primary-text hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          <AnalysisHistory limit={3} />
        </section>
      </div>
    </AppShell>
  );
}
