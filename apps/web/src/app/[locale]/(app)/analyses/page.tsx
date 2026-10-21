import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import type { Locale } from '@offerleap/shared';

import { AnalysesView } from '@/features/analyses/components/AnalysesView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('analyses');
  return { title: t('metaTitle') };
}

export default async function AnalysesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AppShell>
      {/* The history's page and page size are read from the URL, which needs a Suspense boundary. */}
      <Suspense>
        <AnalysesView />
      </Suspense>
    </AppShell>
  );
}
