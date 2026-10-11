import { getTranslations } from 'next-intl/server';
import { type ReactNode, Suspense } from 'react';

import { AuthLayout } from '@/components/templates';

/**
 * @description Server wrapper that fills `AuthLayout` with translated chrome (brand highlights, home link).
 * @param props - Page title/description, the form, and an optional footer.
 */
export async function AuthPage({
  children,
  ...props
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations();
  return (
    <AuthLayout
      {...props}
      homeLabel={t('common.backToHome')}
      highlights={[
        { icon: 'file-text', text: t('auth.highlights.parse') },
        { icon: 'target', text: t('auth.highlights.match') },
        { icon: 'message-square', text: t('auth.highlights.interview') },
      ]}
    >
      {/* Forms read `?token` / `?next` with useSearchParams, which needs a Suspense boundary for static pages. */}
      <Suspense>{children}</Suspense>
    </AuthLayout>
  );
}
