import { APP_NAME, APP_TAGLINE } from '@offerleap/shared';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { buttonClasses, Icon } from '@/components/atoms';

import { SCENE_PHOTOS } from '../photos';

/**
 * @description The peak and the close, one pinned act and the longest on the page. It opens on the two photos half
 * and half; then the divider sweeps to the edge (LandingMotion writes `--ol-peak-d`), the night is gone, the morning
 * photo takes the frame with a slow push-in, and the call to action lands inside it and holds.
 * @param props.registerHref - Locale-aware sign-up URL.
 * @param props.signInHref - Locale-aware sign-in URL.
 */
export function MorningClose({ registerHref, signInHref }: { registerHref: string; signInHref: string }) {
  const t = useTranslations('home');

  return (
    <section id="close" data-sc-act="pin" data-sc-span="3" aria-labelledby="close-title" className="ol-close">
      <div data-sc-stage>
        <div className="ol-split">
          <div className="ol-split__layer ol-split__night ol-night">
            <Image src={SCENE_PHOTOS.night} alt="" fill sizes="100vw" className="object-cover" />
            <div className="ol-scrim ol-scrim--night" />
            <p
              data-sc-cue="0 0.22 0 0.06"
              className="absolute bottom-[14vh] left-(--sc-gutter) z-5 w-[min(30vw,26rem)] text-3xl leading-tight font-bold tracking-tight text-balance text-night-fg max-md:top-16 max-md:right-(--sc-gutter) max-md:bottom-auto max-md:w-auto max-md:text-2xl"
            >
              {t('close.nightLine')}
            </p>
          </div>

          <div className="ol-split__layer ol-split__day">
            <Image
              src={SCENE_PHOTOS.morning}
              alt={t('hero.dayAlt')}
              fill
              sizes="100vw"

              className="object-cover"
            />
            <div className="ol-scrim ol-scrim--before" />
            <div className="ol-scrim ol-scrim--close" />
            <p
              data-sc-cue="0 0.22 0 0.06"
              className="absolute right-(--sc-gutter) bottom-[14vh] z-5 w-[min(30vw,26rem)] text-right text-3xl leading-tight font-bold tracking-tight text-balance text-fg max-md:bottom-[10vh] max-md:left-(--sc-gutter) max-md:w-auto max-md:text-left max-md:text-2xl"
            >
              {t('close.dayLine')}
            </p>

            <div
              data-sc-cue="0.56"
              data-sc-rise="0.6"
              className="absolute top-1/2 left-(--sc-gutter) z-5 flex w-[min(34rem,38vw)] -translate-y-1/2 flex-col gap-4 text-fg max-md:top-auto max-md:right-(--sc-gutter) max-md:bottom-24 max-md:w-auto max-md:translate-y-0"
            >
              <h2
                id="close-title"
                className="text-4xl leading-[1.04] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              >
                {t('close.title')}
              </h2>
              <p className="max-w-[36ch] text-lg text-pretty">{t('close.body')}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                <a href={registerHref} className={buttonClasses({ size: 'lg' })}>
                  {t('hero.ctaPrimary')}
                  <Icon name="arrow-right" size="sm" />
                </a>
                <a href={signInHref} className={buttonClasses({ variant: 'outline', size: 'lg' })}>
                  {t('hero.ctaSecondary')}
                </a>
              </div>
            </div>

            <footer
              data-sc-cue="0.6"
              className="absolute inset-x-0 bottom-0 z-6 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border bg-bg px-(--sc-gutter) py-3 text-sm text-fg-muted"
            >
              <span>
                <strong className="text-fg">{APP_NAME}</strong> · {APP_TAGLINE}
              </span>
              <span>{t('close.imageCredit')}</span>
            </footer>
          </div>

          <span
            aria-hidden
            className="ol-close__line absolute inset-y-0 z-8 w-0.5 -translate-x-px bg-surface"
          />
        </div>
      </div>
    </section>
  );
}
