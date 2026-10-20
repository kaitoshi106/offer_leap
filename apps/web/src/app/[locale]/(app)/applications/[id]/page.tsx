import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { ApplicationDetailView } from '@/features/applications/components/ApplicationDetailView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('applications');
  return { title: t('metaTitle') };
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <AppShell>
      <ApplicationDetailView id={id} />
    </AppShell>
  );
}
