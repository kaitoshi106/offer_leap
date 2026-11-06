import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface DuoSideProps {
  title: ReactNode;
  body?: ReactNode;
  /** The surface under the copy (form, score, letter…). */
  children: ReactNode;
  className?: string;
}

/**
 * @description One side of a middle act. The night side is always dark (night tokens); the day side follows the
 * app theme. Both carry real content the whole way down: neither is a caption for the other.
 */
function DuoSide({ side, title, body, children, className }: DuoSideProps & { side: 'night' | 'day' }) {
  const t = useTranslations('home');
  const night = side === 'night';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 px-6 pt-[clamp(5rem,11vh,8rem)] pb-[clamp(4rem,9vh,7rem)] max-md:pt-16 max-md:pb-12 sm:px-[clamp(1.5rem,4.5vw,5rem)]',
        night ? 'ol-night bg-night text-night-fg' : 'bg-bg text-fg',
        className,
      )}
    >
      <p
        className={cn(
          'text-xs font-bold tracking-[0.08em] uppercase',
          night ? 'text-night-fg-muted' : 'text-fg-muted',
        )}
      >
        {t(`sides.${side}`)}
      </p>
      <h3 className="text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
        {title}
      </h3>
      {body && (
        <p className={cn('max-w-[44ch] text-pretty', night ? 'text-night-fg-muted' : 'text-fg-muted')}>
          {body}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

interface DuoProps {
  id: string;
  /** Accessible name of the act (rendered as a visually hidden h2). */
  label: string;
  night: DuoSideProps;
  day: DuoSideProps;
  className?: string;
  /** Extra attributes for the section, e.g. engine `data-sc-*` hooks. */
  sectionProps?: Record<string, string>;
  /** Pinned act: the two columns become the engine's sticky stage. */
  pinned?: boolean;
}

/**
 * @description A middle act of the split stage: two columns held side by side (stacked on phones), night on the
 * left, day on the right, meeting at the fixed spine.
 * @param props - {@link DuoProps}
 */
export function Duo({ id, label, night, day, className, sectionProps, pinned = false }: DuoProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={className} {...sectionProps}>
      <h2 id={`${id}-title`} className="sr-only">
        {label}
      </h2>
      <div
        {...(pinned ? { 'data-sc-stage': '' } : {})}
        className={cn(
          'grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          pinned && 'grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1',
        )}
      >
        <DuoSide side="night" {...night} />
        <DuoSide side="day" {...day} />
      </div>
    </section>
  );
}

/**
 * @description The spine: fixed chrome for the middle acts. On wide screens it is the divider itself, with both
 * labels and the argument's progress; on phones it is a sticky two-label bar with the progress underneath.
 * LandingMotion shows it between the hero and the close and fills it as the reader moves through.
 */
export function SplitSpine() {
  const t = useTranslations('home');

  return (
    <div id="spine" aria-hidden className="ol-spine">
      <span className="ol-spine__line" />
      <span className="ol-spine__fill" />
      <div className="ol-spine__tags whitespace-nowrap">
        <span className="grid place-items-center rounded-full bg-night px-2.5 py-1 text-xs font-bold text-night-fg max-md:rounded-none">
          {t('sides.night')}
        </span>
        <span className="grid place-items-center rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-fg shadow-card max-md:rounded-none">
          {t('sides.day')}
        </span>
      </div>
    </div>
  );
}
