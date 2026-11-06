import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { use } from 'react';

import { type Locale } from '@offerleap/shared';

import { SplitSpine } from '@/features/home/components/Duo';
import { HeroSplit } from '@/features/home/components/HeroSplit';
import { LandingMotion } from '@/features/home/components/LandingMotion';
import { InterviewAct, LetterAct, MatchAct, ProfileAct } from '@/features/home/components/MiddleActs';
import { MorningClose } from '@/features/home/components/MorningClose';
import '@/features/home/landing.css';
import { getPathname } from '@/i18n/navigation';

/**
 * @description Public landing page, a split stage built with the scrollcraft method: the same job seeker on her own
 * and with OfferLeap, side by side, until the divider sweeps away and the morning takes the frame.
 *
 * Links that leave the page are plain locale-aware `<a>` elements, so leaving is a full page load: the landing
 * stylesheet and the scroll engine never carry over into the app.
 * @param props.params - Route params containing the locale.
 */
export default function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('common');

  const registerHref = getPathname({ href: '/register', locale });
  const signInHref = getPathname({ href: '/login', locale });

  return (
    // Keyed by locale: a language switch mounts a fresh tree, so the engine never drives nodes React replaced.
    <div key={locale} id="landing" className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-60 rounded-md bg-surface px-4 py-2 shadow-popover focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('skipToContent')}
      </a>

      <SplitSpine />

      <main id="main">
        <HeroSplit registerHref={registerHref} signInHref={signInHref} />
        <ProfileAct />
        <MatchAct />
        <LetterAct />
        <InterviewAct />
        <MorningClose registerHref={registerHref} signInHref={signInHref} />
      </main>

      <LandingMotion />
    </div>
  );
}
