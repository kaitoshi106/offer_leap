import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LoginForm, AuthPage } from '@/features/auth/components';
import type { Locale } from '@offerleap/shared';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  return (
    <AuthPage
      title={t('login.title')}
      description={t('login.description')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('login.signUp')}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthPage>
  );
}
