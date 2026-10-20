import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import type { Locale } from '@offerleap/shared';

import { AdminShell } from '@/features/admin/components/AdminShell';
import { AdminUsersView } from '@/features/admin/components/AdminUsersView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('users.title')} · ${t('metaTitle')}` };
}

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AdminShell>
      {/* Filters are read from the URL, which needs a Suspense boundary for static rendering. */}
      <Suspense>
        <AdminUsersView />
      </Suspense>
    </AdminShell>
  );
}
