'use client';

import { LOCALES } from '@offerleap/shared';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

import { VisuallyHidden } from '../../atoms';

/**
 * @description Segmented "VI | EN" control. The current language is highlighted and marked `aria-current`; the
 * other one is a link to the same page in that language (works without JS and can open in a new tab), query
 * string included — a reset or verification token, `?next=` or a filter must survive the switch.
 * @param props.className - Extra classes for positioning.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  // Reading the query makes statically rendered pages render this part in the browser; until then the same
  // links without the query are shown (identical on screen, so nothing moves).
  return (
    <Suspense fallback={<LocaleLinks className={className} search="" />}>
      <LocaleLinksWithQuery className={className} />
    </Suspense>
  );
}

function LocaleLinksWithQuery({ className }: { className?: string }) {
  const search = useSearchParams()?.toString() ?? '';
  return <LocaleLinks className={className} search={search} />;
}

function LocaleLinks({ className, search }: { className?: string; search: string }) {
  const t = useTranslations('locale');
  const current = useLocale();
  const pathname = usePathname();
  const href = search ? `${pathname}?${search}` : pathname;

  return (
    <nav
      aria-label={t('label')}
      className={cn(
        'inline-flex rounded-full border border-border bg-surface-muted p-0.5 text-xs font-semibold',
        className,
      )}
    >
      {LOCALES.map((locale) => {
        const content = (
          <>
            <span aria-hidden>{locale.toUpperCase()}</span>
            <VisuallyHidden>{t(locale)}</VisuallyHidden>
          </>
        );
        const itemClasses =
          'inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 transition-colors';

        return locale === current ? (
          <span
            key={locale}
            lang={locale}
            aria-current="true"
            title={t(locale)}
            className={cn(itemClasses, 'bg-primary text-primary-fg shadow-card')}
          >
            {content}
          </span>
        ) : (
          <Link
            key={locale}
            href={href}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            title={t(locale)}
            className={cn(itemClasses, 'text-fg-muted hover:text-fg')}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
