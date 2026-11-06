import type { ReactNode } from 'react';

import { APP_NAME } from '@offerleap/shared';

import { Link } from '@/i18n/navigation';

import { Heading, Icon, Text } from '../../atoms';
import { LocaleSwitcher, ThemeToggle } from '../../molecules';
import { AuthScene, type AuthSceneCopy, type AuthScenePhotos } from './AuthScene';

export interface AuthLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Accessible name of the logo link to the home page. */
  homeLabel: string;
  /** Text of the photographic scene (translated). */
  scene: AuthSceneCopy;
  /** Photos of the scene. */
  photos: AuthScenePhotos;
  /** `morning` (one photo) or `split` (tonight and tomorrow morning side by side). */
  sceneVariant?: 'morning' | 'split';
  children: ReactNode;
  /** Below the form, e.g. "No account yet? Sign up". */
  footer?: ReactNode;
}

/**
 * @description Two-column layout for auth pages: a photographic scene on the left (large screens; a short strip of
 * it above the form on smaller ones) and the form on the right with the language/theme controls. Has no data
 * fetching — pages pass translated text in.
 * @param props - {@link AuthLayoutProps}
 */
export function AuthLayout({
  title,
  description,
  homeLabel,
  scene,
  photos,
  sceneVariant = 'morning',
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden lg:block">
        <div className="sticky top-0 h-dvh">
          <AuthScene copy={scene} photos={photos} variant={sceneVariant} />
          <Link
            href="/"
            aria-label={`${APP_NAME} – ${homeLabel}`}
            className="absolute top-12 left-12 z-10 flex items-center gap-2 text-lg font-bold text-night-fg"
          >
            <Icon name="sparkles" className="text-night-accent" />
            {APP_NAME}
          </Link>
        </div>
      </aside>

      {/* The form side sits on a quiet tinted ground; from sm the form is a raised card on it. */}
      <div className="flex flex-col bg-surface-muted">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link
            href="/"
            aria-label={`${APP_NAME} – ${homeLabel}`}
            className="flex items-center gap-2 font-bold lg:invisible"
          >
            <Icon name="sparkles" className="text-primary-text" />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

        {/* Small screens: a strip of the scene, so the page keeps its picture without pushing the form away. */}
        <div className="relative mx-4 h-32 overflow-hidden rounded-xl sm:mx-8 sm:h-40 lg:hidden">
          <AuthScene copy={scene} photos={photos} variant={sceneVariant} layout="band" />
        </div>

        <main id="main" className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="flex w-full max-w-md flex-col gap-6 sm:max-w-[30rem] sm:rounded-2xl sm:bg-surface sm:p-8 sm:shadow-popover sm:ring-1 sm:ring-border">
            <div className="flex flex-col gap-2">
              <Heading level={1} size="lg">
                {title}
              </Heading>
              {description && <Text tone="muted">{description}</Text>}
            </div>
            {children}
            {footer && <div className="text-center text-sm text-fg-muted">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
