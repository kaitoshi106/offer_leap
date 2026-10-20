import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AdminInvitationsView } from '@/features/admin/components/AdminInvitationsView';
import { AdminShell } from '@/features/admin/components/AdminShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('admins.title')} · ${t('metaTitle')}` };
}

export default async function AdminAdminsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AdminShell>
      <AdminInvitationsView />
    </AdminShell>
  );
}
