import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { APP_NAME, type Locale } from '@offerleap/shared';

import { Badge, buttonClasses, Heading, Icon, type IconName, Text } from '@/components/atoms';
import { LocaleSwitcher, ThemeToggle } from '@/components/molecules';
import { Link } from '@/i18n/navigation';

const FEATURES: { key: 'parse' | 'match' | 'interview'; icon: IconName }[] = [
  { key: 'parse', icon: 'file-text' },
  { key: 'match', icon: 'target' },
  { key: 'interview', icon: 'message-square' },
];

/**
 * @description Public landing page.
 * @param props.params - Route params containing the locale.
 */
export default function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 shadow-popover focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('common.skipToContent')}
      </a>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-lg font-bold">
          <Icon name="sparkles" className="text-primary" />
          {APP_NAME}
        </span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Badge tone="ai" icon={<Icon name="sparkles" size="xs" />}>
            {t('home.badge')}
          </Badge>
          <Heading level={1}>{t('home.title')}</Heading>
          <Text size="lg" tone="muted" className="text-pretty">
            {t('home.description')}
          </Text>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonClasses({ size: 'lg' })}>
              {t('home.ctaPrimary')}
              <Icon name="arrow-right" size="sm" />
            </Link>
            <Link href="/login" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
              {t('home.ctaSecondary')}
            </Link>
          </div>
        </section>

        <ul className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ key, icon }) => (
            <li key={key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
                <Icon name={icon} />
              </span>
              <Heading level={2} size="sm" className="mb-2">
                {t(`home.features.${key}.title`)}
              </Heading>
              <Text size="sm" tone="muted">
                {t(`home.features.${key}.description`)}
              </Text>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
