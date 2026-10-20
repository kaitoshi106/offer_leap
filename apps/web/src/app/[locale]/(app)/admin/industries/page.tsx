import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AdminIndustriesView } from '@/features/admin/components/AdminIndustriesView';
import { AdminShell } from '@/features/admin/components/AdminShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('industries.title')} · ${t('metaTitle')}` };
}

export default async function AdminIndustriesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AdminShell>
      <AdminIndustriesView />
    </AdminShell>
  );
}
