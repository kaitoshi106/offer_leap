import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ForgotPasswordForm, AuthPage } from '@/features/auth/components';
import type { Locale } from '@offerleap/shared';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgot');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  return (
    <AuthPage
      title={t('forgot.title')}
      description={t('forgot.description')}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthPage>
  );
}
