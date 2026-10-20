'use client';

import { useTranslations } from 'next-intl';

import { buttonClasses, Heading, Icon, Skeleton, Text } from '@/components/atoms';
import { AnalysisHistory } from '@/features/analyses/components/AnalysisHistory';
import { AppShell } from '@/features/app-shell/AppShell';
import { useCurrentUser } from '@/features/auth/api/use-auth';
import { Link } from '@/i18n/navigation';

/** Signed-in home: greeting, a shortcut to analyse a job posting and the latest analyses. */
export function DashboardView() {
  const t = useTranslations('dashboard');
  const { data: user } = useCurrentUser();

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          {user ? (
            <Heading level={1} size="lg">
              {t('greeting', { name: user.fullName })}
            </Heading>
          ) : (
            <Skeleton className="h-8 w-1/2" />
          )}
          <Text tone="muted">{t('subtitle')}</Text>
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
