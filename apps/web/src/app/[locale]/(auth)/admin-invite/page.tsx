import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@offerleap/shared';

import { AcceptInvitationForm, AuthPage } from '@/features/auth/components';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.invite');
  return { title: t('title') };
}

export default async function AdminInvitePage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth.invite');
  return (
    <AuthPage title={t('title')} description={t('description')}>
      <AcceptInvitationForm />
    </AuthPage>
  );
}
