import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

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
      <AnalysesView />
    </AppShell>
  );
}
