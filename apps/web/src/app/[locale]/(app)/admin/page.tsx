import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AdminShell } from '@/features/admin/components/AdminShell';
import { AdminUsageView } from '@/features/admin/components/AdminUsageView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('usage.title')} · ${t('metaTitle')}` };
}

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AdminShell>
      <AdminUsageView />
    </AdminShell>
  );
}
