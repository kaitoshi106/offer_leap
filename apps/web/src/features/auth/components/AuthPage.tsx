import { getTranslations } from 'next-intl/server';
import { type ReactNode, Suspense } from 'react';

import { AuthLayout } from '@/components/templates';
import { scoreBand } from '@/features/analyses/components/match';
// The scene shares the landing page's photos and sample match.
import { DEMO_MATCH } from '@/features/home/demo';
import { SCENE_PHOTOS } from '@/features/home/photos';

/**
 * @description Server wrapper that fills `AuthLayout` with translated chrome (scene text, home link).
 * @param props - Page title/description, the form, an optional footer, and which scene to show: `morning` for
 * pages of returning users, `split` (tonight → tomorrow morning) for sign-up.
 */
export async function AuthPage({
  children,
  scene = 'morning',
  ...props
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  scene?: 'morning' | 'split';
  children: ReactNode;
}) {
  const t = await getTranslations();
  const { level } = scoreBand(DEMO_MATCH.score);
  return (
    <AuthLayout
      {...props}
      homeLabel={t('common.backToHome')}
      photos={SCENE_PHOTOS}
      sceneVariant={scene}
      scene={{
        line: scene === 'split' ? t('auth.scene.registerDay') : t('auth.scene.loginLine'),
        nightLine: t('auth.scene.registerNight'),
        chips: [
          `${DEMO_MATCH.score} · ${t(`analyses.result.levels.${level}`)}`,
          t('auth.scene.profileReady'),
        ],
        credit: t('auth.scene.credit'),
      }}
    >
      {/* Forms read `?token` / `?next` with useSearchParams, which needs a Suspense boundary for static pages. */}
      <Suspense>{children}</Suspense>
    </AuthLayout>
  );
}
