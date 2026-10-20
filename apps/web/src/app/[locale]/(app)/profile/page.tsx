import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { ProfileView } from '@/features/profile/components/ProfileView';
import { AppShell } from '@/features/app-shell/AppShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('metaTitle') };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AppShell>
      <ProfileView />
    </AppShell>
  );
}
