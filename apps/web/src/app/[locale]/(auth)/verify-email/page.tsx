import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { VerifyEmail, AuthPage } from '@/features/auth/components';
import type { Locale } from '@offerleap/shared';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.verify');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  return (
    <AuthPage
      title={t('verify.title')}

      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      <VerifyEmail />
    </AuthPage>
  );
}
