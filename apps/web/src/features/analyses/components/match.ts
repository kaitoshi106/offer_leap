import { type MatchLevel, matchLevel } from '@offerleap/shared';

import type { ScoreTone } from '@/components/molecules';

const TONE: Record<MatchLevel, ScoreTone> = {
  STRONG: 'success',
  GOOD: 'primary',
  FAIR: 'warning',
  WEAK: 'danger',
};

/**
 * @description Level and colour of a match score (shared bands, so every screen labels a score the same way).
 * @param score - 0–100.
 */
export function scoreBand(score: number): { level: MatchLevel; tone: ScoreTone } {
  const level = matchLevel(score);
  return { level, tone: TONE[level] };
}
