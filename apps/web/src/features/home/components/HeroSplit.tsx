import { APP_NAME } from '@offerleap/shared';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { buttonClasses, Icon } from '@/components/atoms';
import { LocaleSwitcher, ScoreGauge, ThemeToggle } from '@/components/molecules';
import { scoreBand } from '@/features/analyses/components/match';

import { DEMO_MATCH } from '../demo';
import { SCENE_PHOTOS } from '../photos';
import { DividerHandle } from './DividerHandle';

/**
 * @description First screen of the split stage: the same person on two evenings, side by side. Each photo is
 * clipped to its side of the divider and moves on its own parallax plane, with real-markup chips in front of them;
 * both headlines read at once. The divider is a slider (DividerHandle).
 * @param props.registerHref - Locale-aware sign-up URL.
 * @param props.signInHref - Locale-aware sign-in URL.
 */
export function HeroSplit({ registerHref, signInHref }: { registerHref: string; signInHref: string }) {
  const t = useTranslations();
  const { level, tone } = scoreBand(DEMO_MATCH.score);
  const levelText = t(`analyses.result.levels.${level}`);

  return (
    <section id="top" data-sc-act="flow" aria-labelledby="hero-title" className="ol-hero">
      <div className="ol-split">
        <div className="ol-split__layer ol-split__night ol-night">
          <div className="ol-split__para" data-sc-parallax="-1.2">
            <Image
              src={SCENE_PHOTOS.night}
              alt={t('home.hero.nightAlt')}
              fill
              priority
              sizes="100vw"

              className="object-cover"
            />
          </div>
          <div className="ol-scrim ol-scrim--night" />
          <div className="ol-hero__night-copy absolute z-5 flex flex-col gap-4 text-night-fg max-md:gap-2">
            <p className="text-3xl leading-[1.05] font-bold tracking-tight text-balance sm:text-4xl xl:text-5xl">
              {t('home.hero.nightTitle')}
            </p>
            <p className="max-w-[34ch] text-lg text-pretty text-night-fg-muted max-md:hidden">
              {t('home.hero.nightBody')}
            </p>
          </div>
          <div
            aria-hidden
            data-sc-parallax="1.6"
            className="ol-hero__file absolute bottom-[18%] z-4 -rotate-6 rounded-xl bg-night-fg px-3.5 py-2.5 text-sm text-night shadow-popover max-md:hidden"
          >
            <strong className="block">{t('home.hero.fileName')}</strong>
            <span className="text-xs opacity-70">{t('home.hero.fileEdited')}</span>
          </div>
        </div>

        <div className="ol-split__layer ol-split__day">
          <div className="ol-split__para" data-sc-parallax="-1.2">
            <Image
              src={SCENE_PHOTOS.morning}
              alt={t('home.hero.dayAlt')}
              fill
              priority
              sizes="100vw"

              className="object-cover"
            />
          </div>
          <div className="ol-scrim ol-scrim--day" />
          <div className="ol-hero__day-copy absolute z-5 flex flex-col gap-4 text-fg max-md:gap-3">
            <h1
              id="hero-title"
              className="text-3xl leading-[1.04] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] xl:text-6xl"
            >
              {t('home.hero.title')}
            </h1>
            <p className="max-w-[40ch] text-lg text-pretty text-fg-muted max-md:text-base">
              {t('home.hero.description')}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={registerHref} className={buttonClasses({ size: 'lg' })}>
                {t('home.hero.ctaPrimary')}
                <Icon name="arrow-right" size="sm" />
              </a>
            </div>
          </div>
          <div
            aria-hidden
            data-sc-parallax="2"
            className="absolute top-[18%] right-[calc(var(--sc-gutter)+2rem)] z-4 flex items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5 text-sm text-fg shadow-popover max-md:hidden"
          >
            <ScoreGauge
              score={DEMO_MATCH.score}
              size="sm"
              tone={tone}
              label={t('analyses.result.score')}
              valueText={`${t('analyses.result.scoreValue', { score: DEMO_MATCH.score })}, ${levelText}`}
            />
            <span>
              <strong className="block">{levelText}</strong>
              <span className="text-fg-muted">{t('home.demo.jobTitle')}</span>
            </span>
          </div>
        </div>

        <div className="ol-hero__topbar absolute top-4 right-(--sc-gutter) z-6 flex items-center justify-between gap-3 whitespace-nowrap max-md:text-night-fg">
          <a
            href="#top"
            aria-label={t('home.nav.home')}
            className="flex items-center gap-2 rounded-md text-lg font-extrabold tracking-tight"
          >
            <Icon name="sparkles" className="text-primary-text max-md:text-night-accent" />
            {APP_NAME}
          </a>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <a
              href={signInHref}
              className="ml-1 hidden h-10 items-center rounded-md px-3 text-sm font-semibold underline-offset-4 hover:underline sm:inline-flex"
            >
              {t('home.nav.signIn')}
            </a>
          </div>
        </div>

        <DividerHandle />
      </div>
    </section>
  );
}
