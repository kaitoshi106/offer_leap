import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { DocumentsView } from '@/features/knowledge/components/DocumentsView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('documents');
  return { title: t('metaTitle') };
}

export default async function DocumentsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AppShell>
      <DocumentsView />
    </AppShell>
  );
}
