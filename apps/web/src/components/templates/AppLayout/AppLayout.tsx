import type { ReactNode } from 'react';

import { APP_NAME } from '@offerleap/shared';

import { cn } from '@/lib/cn';

import { Icon } from '../../atoms';
import { LocaleSwitcher, ThemeToggle } from '../../molecules';

export interface AppLayoutProps {
  children: ReactNode;
  /** Wraps the brand so it can link home (the template stays router-agnostic). */
  brand?: (content: ReactNode) => ReactNode;
  /** Main navigation links (rendered inside a labelled `<nav>`). */
  nav?: ReactNode;
  navLabel?: string;
  /** Controls on the right, after language and theme (e.g. account and sign-out). */
  actions?: ReactNode;
  width?: 'lg' | 'xl';
}

const WIDTH = { lg: 'max-w-4xl', xl: 'max-w-6xl' } as const;

/**
 * @description Shell for signed-in pages: header with brand, main navigation, language/theme switches and
 * account actions; content column below. On small screens the navigation moves to its own scrollable row.
 * Presentational only — links and data come from the caller.
 * @param props - {@link AppLayoutProps}
 */
export function AppLayout({
  children,
  brand = (content) => content,
  nav,
  navLabel,
  actions,
  width = 'xl',
}: AppLayoutProps) {
  const navigation = nav && (
    <nav aria-label={navLabel}>
      <ul className="flex items-center gap-1">{nav}</ul>
    </nav>
  );
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className={cn('mx-auto flex w-full items-center gap-6 px-4 py-3 sm:px-6', WIDTH[width])}>
          {brand(
            <span className="flex items-center gap-2 font-bold">
              <Icon name="sparkles" className="text-primary-text" />
              {APP_NAME}
            </span>,
          )}
          <div className="hidden flex-1 md:block">{navigation}</div>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            {actions}
          </div>
        </div>
        {navigation && (
          <div className="overflow-x-auto border-t border-border px-4 py-2 md:hidden">{navigation}</div>
        )}
      </header>
      <main id="main" className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6', WIDTH[width])}>
        {children}
      </main>
    </div>
  );
}

/**
 * @description Class names for a navigation link; pass `active` for the current section (also set
 * `aria-current="page"` on the link).
 * @param active - Whether the link points to the current section.
 */
export function navLinkClasses(active: boolean): string {
  return cn(
    'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
    'outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
    active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  );
}
