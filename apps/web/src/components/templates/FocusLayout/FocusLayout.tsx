import type { ReactNode } from 'react';

import { APP_NAME } from '@offerleap/shared';

import { cn } from '@/lib/cn';

import { Icon } from '../../atoms';
import { LocaleSwitcher, ThemeToggle } from '../../molecules';

export interface FocusLayoutProps {
  children: ReactNode;
  /** Extra header controls on the right (e.g. a sign-out button). */
  actions?: ReactNode;
  /** Max width of the content column. */
  width?: 'md' | 'lg' | 'xl';
}

const WIDTH = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
 * @description Distraction-free page for single-task flows (onboarding, wizards): slim header with the brand,
 * language and theme controls, and one centred column. Has no data fetching.
 * @param props - {@link FocusLayoutProps}
 */
export function FocusLayout({ children, actions, width = 'lg' }: FocusLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-bold">
            <Icon name="sparkles" className="text-primary-text" />
            {/* The smallest phones (320px) have no room for the name next to the controls: icon only there. */}
            <span className="max-[379px]:sr-only">{APP_NAME}</span>
          </span>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </header>
      <main id="main" className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12', WIDTH[width])}>
        {children}
      </main>
    </div>
  );
}
