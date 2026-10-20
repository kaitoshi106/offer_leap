import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AdminShell } from '@/features/admin/components/AdminShell';
import { AdminUserView } from '@/features/admin/components/AdminUserView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('users.title')} · ${t('metaTitle')}` };
}

export default async function AdminUserPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <AdminShell>
      <AdminUserView id={id} />
    </AdminShell>
  );
}
