import type { ReactNode } from 'react';

import { APP_NAME, APP_TAGLINE } from '@offerleap/shared';

import { Link } from '@/i18n/navigation';

import { Heading, Icon, type IconName, Text } from '../../atoms';
import { LocaleSwitcher, ThemeToggle } from '../../molecules';

export interface AuthLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Brand panel bullet points (translated). */
  highlights: { icon: IconName; text: string }[];
  /** Accessible name of the logo link to the home page. */
  homeLabel: string;
  children: ReactNode;
  /** Below the card, e.g. "No account yet? Sign up". */
  footer?: ReactNode;
}

/**
 * @description Two-column layout for auth pages: brand panel (large screens) and a centered form card with the
 * language/theme controls. Has no data fetching — pages pass translated text in.
 * @param props - {@link AuthLayoutProps}
 */
export function AuthLayout({ title, description, highlights, homeLabel, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-fg lg:flex">
        <Link href="/" aria-label={homeLabel} className="flex items-center gap-2 text-lg font-bold">
          <Icon name="sparkles" />
          {APP_NAME}
        </Link>
        <div className="flex flex-col gap-6">
          <p className="max-w-md text-3xl leading-tight font-bold text-balance">{APP_TAGLINE}</p>
          <ul className="flex flex-col gap-3">
            {highlights.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 opacity-90">
                <Icon name={icon} size="sm" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <span aria-hidden className="absolute -right-24 -bottom-24 size-80 rounded-full bg-primary-fg/10" />
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/" aria-label={homeLabel} className="flex items-center gap-2 font-bold lg:invisible">
            <Icon name="sparkles" className="text-primary" />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="flex w-full max-w-md flex-col gap-6">
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
