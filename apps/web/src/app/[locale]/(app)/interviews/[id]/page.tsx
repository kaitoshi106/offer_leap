import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { InterviewSessionView } from '@/features/interviews/components/InterviewSessionView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('interviews');
  return { title: t('metaTitle') };
}

export default async function InterviewPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <AppShell>
      <InterviewSessionView id={id} />
    </AppShell>
  );
}
