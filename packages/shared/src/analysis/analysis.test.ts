import { describe, expect, it } from 'vitest';

import { createAnalysisSchema, JOB_DESCRIPTION_LIMITS, matchLevel } from './index';

const jd = 'We are hiring a Senior Frontend Developer with React and TypeScript experience. '.repeat(3);

describe('createAnalysisSchema', () => {
  it('accepts a CV id, a job description and a locale', () => {
    const result = createAnalysisSchema.parse({
      resumeId: ' r1 ',
      jobDescription: `  ${jd}  `,
      locale: 'vi',
    });
    expect(result).toEqual({ resumeId: 'r1', jobDescription: jd.trim(), locale: 'vi' });
  });

  it.each([
    ['empty', '   ', 'required'],
    ['too short to analyse', 'React developer', 'tooShort'],
    ['too long', 'x'.repeat(JOB_DESCRIPTION_LIMITS.max + 1), 'tooLong'],
  ])('rejects a job description that is %s', (_case, jobDescription, rule) => {
    const result = createAnalysisSchema.safeParse({ resumeId: 'r1', jobDescription, locale: 'en' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(rule);
  });

  it('requires a CV and a supported locale', () => {
    const result = createAnalysisSchema.safeParse({ resumeId: '', jobDescription: jd, locale: 'fr' });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['resumeId', 'locale']);
  });
});

describe('matchLevel', () => {
  it.each([
    [100, 'STRONG'],
    [80, 'STRONG'],
    [79, 'GOOD'],
    [65, 'GOOD'],
    [64, 'FAIR'],
    [45, 'FAIR'],
    [44, 'WEAK'],
    [0, 'WEAK'],
  ])('%i is %s', (score, level) => {
    expect(matchLevel(score)).toBe(level);
  });
});
