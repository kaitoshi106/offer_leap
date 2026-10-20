/** Length limits for a pasted job description (characters, after trimming). */
export const JOB_DESCRIPTION_LIMITS = { min: 100, max: 20_000 } as const;

export const SkillImportance = {
  REQUIRED: 'REQUIRED',
  NICE_TO_HAVE: 'NICE_TO_HAVE',
} as const;
export type SkillImportance = (typeof SkillImportance)[keyof typeof SkillImportance];
export const SKILL_IMPORTANCES = Object.values(SkillImportance);

/** Score bands used to label and colour a match score. */
export const MatchLevel = {
  STRONG: 'STRONG',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  WEAK: 'WEAK',
} as const;
export type MatchLevel = (typeof MatchLevel)[keyof typeof MatchLevel];

/**
 * @description Band of a 0–100 match score: ≥ 80 strong, ≥ 65 good, ≥ 45 fair, otherwise weak.
 * @param score - Match score from the analysis.
 */
export function matchLevel(score: number): MatchLevel {
  if (score >= 80) return MatchLevel.STRONG;
  if (score >= 65) return MatchLevel.GOOD;
  if (score >= 45) return MatchLevel.FAIR;
  return MatchLevel.WEAK;
}
