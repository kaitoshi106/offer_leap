'use client';

import { LOCALES } from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

import { VisuallyHidden } from '../../atoms';

/**
 * @description Segmented "VI | EN" control. The current language is highlighted and marked `aria-current`; the
 * other one is a link to the same page in that language (works without JS and can open in a new tab).
 * @param props.className - Extra classes for positioning.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale');
  const current = useLocale();
  const pathname = usePathname();

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
            href={pathname}
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
