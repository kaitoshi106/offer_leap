import { setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { redirect } from '@/i18n/navigation';

/** `/admin` opens the first section. */
export default async function AdminPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: '/admin/users', locale });
}
