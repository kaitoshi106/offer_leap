'use client';

import { useTranslations } from 'next-intl';

import { Heading, Text } from '@/components/atoms';

import { AnalysisHistory } from './AnalysisHistory';
import { NewAnalysisForm } from './NewAnalysisForm';

/** `/analyses`: start a new analysis and browse past ones. */
export function AnalysesView() {
  const t = useTranslations('analyses');
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="lg">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('description')}</Text>
      </div>
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <section
          aria-labelledby="new-analysis"
          className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-card"
        >
          <Heading level={2} size="sm" id="new-analysis">
            {t('form.title')}
          </Heading>
          <NewAnalysisForm />
        </section>
        <section aria-labelledby="analysis-history" className="flex flex-col gap-4">
          <Heading level={2} size="sm" id="analysis-history">
            {t('history.title')}
          </Heading>
          <AnalysisHistory />
        </section>
      </div>
    </div>
  );
}
