import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AnalysisView } from '@/features/analyses/components/AnalysisView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('analyses');
  return { title: t('metaTitle') };
}

export default async function AnalysisPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <AppShell>
      <AnalysisView id={id} />
    </AppShell>
  );
}
