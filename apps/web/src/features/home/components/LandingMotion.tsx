'use client';

import { useEffect } from 'react';

import { collapseDivider, step } from '../demo';

/** Vendored, unmodified scrollcraft engine (see `public/vendor/scrollcraft`). */
const ENGINE_SRC = '/vendor/scrollcraft/scrollcraft.js';

/** Act progress the close is parked at when keyboard focus lands in it, so its call to action is visible. */
const CLOSE_FOCUS_PROGRESS = 0.8;

/**
 * @description Runs the landing page motion. Mounts the scrollcraft engine on `#landing` (it reads the `data-sc-*`
 * attributes the sections are written with), and drives what is specific to this page from scroll: the spine shown
 * between the hero and the close and filled as the reader moves through, and the close's divider sweep and camera
 * push. Renders nothing visible.
 */
export function LandingMotion() {
  // The engine: mounted on this tree's root and destroyed with it. A language switch mounts a fresh tree, and the
  // script is already loaded by then, so it is used straight away instead of waiting for a load that never comes.
  useEffect(() => {
    let engine: ScrollCraftInstance | null = null;
    let cancelled = false;
    const start = () => {
      const root = document.getElementById('landing');
      if (!cancelled && root && window.ScrollCraft) engine = window.ScrollCraft.mount(root);
    };
    let script: HTMLScriptElement | null = null;
    if (window.ScrollCraft) start();
    else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${ENGINE_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = ENGINE_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', start, { once: true });
    }
    return () => {
      cancelled = true;
      script?.removeEventListener('load', start);
      engine?.destroy();
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById('landing');
    const hero = document.getElementById('top');
    const close = document.getElementById('close');
    const spine = document.getElementById('spine');
    if (!root || !hero || !close || !spine) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const docTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
    let frame = 0;

    const closeTravel = () => Math.max(close.offsetHeight - window.innerHeight, 1);
    const progressAt = (closeTop: number) =>
      Math.min(1, Math.max(0, (window.scrollY - closeTop) / closeTravel()));

    const render = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const y = window.scrollY;
      const heroEnd = docTop(hero) + hero.offsetHeight;
      const closeTop = docTop(close);

      spine.dataset.on = String(y > heroEnd - viewport * 0.35 && y < closeTop - viewport * 0.05);
      const through = (y + viewport * 0.5 - heroEnd) / Math.max(closeTop - heroEnd, 1);
      root.style.setProperty('--ol-spine-p', Math.min(1, Math.max(0, through)).toFixed(4));

      const progress = progressAt(closeTop);
      root.style.setProperty('--ol-peak-d', collapseDivider(progress, reduce.matches).toFixed(4));
      root.style.setProperty('--ol-peak-push', reduce.matches ? '0' : step(progress, 0.1, 1).toFixed(4));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    // A focused link inside the pinned close would otherwise sit where its cue has not opened yet.
    const onFocus = () => {
      const closeTop = docTop(close);
      if (progressAt(closeTop) < 0.7) {
        window.scrollTo({ top: closeTop + closeTravel() * CLOSE_FOCUS_PROGRESS, behavior: 'instant' });
      }
    };

    render();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    close.addEventListener('focusin', onFocus);
    // The engine sets the pinned act heights after it loads, which moves every section below the hero.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      close.removeEventListener('focusin', onFocus);
      resizeObserver.disconnect();
    };
  }, []);

  return null;
}
