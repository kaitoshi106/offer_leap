'use client';

import { type Locale } from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClasses, Icon } from '@/components/atoms';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const OTHER_LOCALE: Record<Locale, Locale> = { vi: 'en', en: 'vi' };

/**
 * @description Link to the current page in the other language. A link (not a button) so it works without JS
 * and can be opened in a new tab.
 * @param props.className - Extra classes for positioning.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale');
  const locale = useLocale();
  const pathname = usePathname();
  const target = OTHER_LOCALE[locale];

  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      aria-label={t('switchTo')}
      className={cn(buttonClasses({ variant: 'ghost', size: 'sm' }), className)}
    >
      <Icon name="globe" size="sm" />
      <span lang={target}>{t(target)}</span>
    </Link>
  );
}
