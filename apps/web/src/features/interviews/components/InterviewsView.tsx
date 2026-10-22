'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { Heading, Skeleton, Text } from '@/components/atoms';

import { InterviewHistory } from './InterviewHistory';
import { NewInterviewForm } from './NewInterviewForm';

/** `/interviews`: start a mock interview and browse past ones. */
export function InterviewsView() {
  const t = useTranslations('interviews');
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="lg">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('description')}</Text>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="new-interview"
          className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-card"
        >
          <Heading level={2} size="sm" id="new-interview">
            {t('form.title')}
          </Heading>
          {/* The form reads ?applicationId=, which needs a Suspense boundary for static rendering. */}
          <Suspense fallback={<Skeleton className="h-80 w-full" />}>
            <NewInterviewForm />
          </Suspense>
        </section>
        <section aria-labelledby="interview-history" className="flex flex-col gap-4">
          <Heading level={2} size="sm" id="interview-history">
            {t('history.title')}
          </Heading>
          <InterviewHistory />
        </section>
      </div>
    </div>
  );
}
