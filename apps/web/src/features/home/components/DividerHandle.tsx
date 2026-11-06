'use client';

import { useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { DIVIDER_RANGE } from '../demo';

/** Media query under which the split turns: night on top, day below. Matches landing.css. */
const PHONE = '(max-width: 860px)';

const clamp = (value: number) => Math.min(DIVIDER_RANGE.max, Math.max(DIVIDER_RANGE.min, value));

/**
 * @description The landing page's signature move: the divider between the two photos is a real slider. Drag it
 * (mouse or touch) or use the arrow keys, Home and End to compare the two evenings. It writes `--ol-d` on the hero
 * section, which clips and re-centres both photos in CSS. On phones the split runs top to bottom and so does the
 * slider.
 */
export function DividerHandle() {
  const t = useTranslations('home');
  const ref = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(0.5);
  const [vertical, setVertical] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    const query = matchMedia(PHONE);
    const update = () => setVertical(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    ref.current?.closest<HTMLElement>('.ol-hero')?.style.setProperty('--ol-d', value.toFixed(4));
  }, [value]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const hero = ref.current?.closest<HTMLElement>('.ol-hero');
      if (!hero) return;
      const box = hero.getBoundingClientRect();
      setValue(
        clamp(vertical ? (event.clientY - box.top) / box.height : (event.clientX - box.left) / box.width),
      );
    };
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [vertical]);

  const onPointerDown = (event: ReactPointerEvent) => {
    dragging.current = true;
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.05;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      ArrowUp: vertical ? -step : step,
      ArrowDown: vertical ? step : -step,
    };
    const move = moves[event.key];
    if (move !== undefined) setValue((current) => clamp(current + move));
    else if (event.key === 'Home') setValue(DIVIDER_RANGE.min);
    else if (event.key === 'End') setValue(DIVIDER_RANGE.max);
    else return;
    event.preventDefault();
  };

  const night = Math.round(value * 100);

  return (
    <div className="ol-handle">
      <span aria-hidden className="ol-handle__line" />
      <button
        ref={ref}
        type="button"
        role="slider"
        aria-label={t('divider.label')}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-valuemin={DIVIDER_RANGE.min * 100}
        aria-valuemax={DIVIDER_RANGE.max * 100}
        aria-valuenow={night}
        aria-valuetext={night === 50 ? t('divider.half') : t('divider.value', { night, day: 100 - night })}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="ol-handle__grip group flex items-center gap-2 focus-visible:outline-none"
      >
        <span className="hidden rounded-full bg-night/85 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-night-fg md:inline">
          {t('sides.night')}
        </span>
        <span className="grid size-12 place-items-center rounded-full bg-surface text-fg shadow-popover transition-transform duration-150 group-hover:scale-105 group-focus-visible:outline-3 group-focus-visible:outline-offset-3 group-focus-visible:outline-ring group-active:scale-95">
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="max-md:rotate-90"
          >
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </span>
        <span className="hidden rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-fg md:inline">
          {t('sides.day')}
        </span>
      </button>
    </div>
  );
}
