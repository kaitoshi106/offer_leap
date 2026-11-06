import { matchLevel } from '@offerleap/shared';

/**
 * Sample data shown on the landing page surfaces, plus the small pieces of scroll maths the page runs on. Every
 * surface labels the data as sample data; the score is computed from it instead of being written in by hand.
 */

export type DemoSkill =
  'react' | 'typescript' | 'nextjs' | 'graphql' | 'playwright' | 'tailwind' | 'jest' | 'teamwork' | 'figma';

/** Skills found in the sample CV. */
export const CV_SKILLS: readonly DemoSkill[] = [
  'react',
  'typescript',
  'nextjs',
  'tailwind',
  'jest',
  'teamwork',
  'figma',
];

/** Skills required by the sample job. */
export const JOB_SKILLS: readonly DemoSkill[] = [
  'react',
  'typescript',
  'nextjs',
  'graphql',
  'playwright',
  'tailwind',
  'jest',
  'teamwork',
];

/**
 * @description Splits the job's required skills into the ones the CV meets and the ones it misses, and scores the
 * match as the share of required skills met.
 * @param cv - Skills found in the CV.
 * @param job - Skills the job requires.
 * @returns Matched and missing skills, the 0–100 score and its band.
 */
export function scoreMatch(cv: readonly DemoSkill[], job: readonly DemoSkill[]) {
  const matched = job.filter((skill) => cv.includes(skill));
  const missing = job.filter((skill) => !cv.includes(skill));
  const score = job.length === 0 ? 0 : Math.round((matched.length / job.length) * 100);
  return { matched, missing, score, level: matchLevel(score) };
}

/** The sample match shown on the page. */
export const DEMO_MATCH = scoreMatch(CV_SKILLS, JOB_SKILLS);

/** The sample mock interview: question 2 of 5, scored out of 10. */
export const DEMO_INTERVIEW = { question: 2, total: 5, score: 7 } as const;

/**
 * @description Eased 0..1 step: 0 before `from`, 1 after `to`, smooth in between.
 * @param value - Current progress.
 * @param from - Where the step starts.
 * @param to - Where the step ends.
 * @returns The eased step.
 */
export function step(value: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / Math.max(to - from, 1e-6)));
  return t * t * (3 - 2 * t);
}

/** Range the visitor can drag the hero divider through (share of the width taken by the "on your own" side). */
export const DIVIDER_RANGE = { min: 0.25, max: 0.75 } as const;

/** Act progress over which the divider sweeps away in the closing act. */
export const COLLAPSE = { from: 0.18, to: 0.52 } as const;

/**
 * @description Where the closing act's divider sits: half and half until the sweep starts, then gone. With reduced
 * motion it changes in one step at the middle of the sweep instead of travelling.
 * @param progress - The closing act's progress (0..1).
 * @param reduced - Whether the visitor asked for reduced motion.
 * @returns The share of the frame still showing the night photo (0.5 → 0).
 */
export function collapseDivider(progress: number, reduced: boolean): number {
  const swept = reduced
    ? progress >= (COLLAPSE.from + COLLAPSE.to) / 2
      ? 1
      : 0
    : step(progress, COLLAPSE.from, COLLAPSE.to);
  return 0.5 * (1 - swept);
}

/**
 * @description `data-sc-cue` for content that writes in during a pinned act and must stay on its card while the
 * stage slides away. The engine holds an act's progress at 1 for the whole exit slide, so a window ending at 1
 * fades the text out exactly while the card is still on screen. This window ends past 1 with no ramp out: the
 * text stays until the act is out of range, where the engine resets it anyway.
 * @param from - Act progress at which the content starts to appear.
 * @param rampIn - Fade-in length, as a fraction of the window (engine semantics); 0 shows it at once.
 * @returns The cue attribute value.
 */
export function holdOnStageCue(from: number, rampIn: number): string {
  return `${from} 1.2 ${rampIn} 0`;
}
