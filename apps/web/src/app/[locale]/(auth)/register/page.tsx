import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RegisterForm, AuthPage } from '@/features/auth/components';
import type { Locale } from '@offerleap/shared';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  return (
    <AuthPage
      title={t('register.title')}
      description={t('register.description')}
      footer={
        <>
          {t('register.hasAccount')}{' '}
          <Link href="/login" className="font-medium text-primary-text hover:underline">
            {t('register.signIn')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthPage>
  );
}
