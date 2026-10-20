import { describe, expect, it } from 'vitest';

import type { JobMatch } from '../ai/prompts/job-match.v2';
import { toAnalysisResult } from './analysis.mapper';

const match = (overrides: Partial<JobMatch> = {}): JobMatch => ({
  jobTitle: ' Senior Frontend Engineer ',
  company: '  ',
  score: 72,
  summary: ' Good fit. ',
  matchedSkills: ['React', 'react ', 'TypeScript', ''],
  missingSkills: [
    { name: 'Playwright', importance: 'NICE_TO_HAVE' },
    { name: 'GraphQL', importance: 'REQUIRED' },
    { name: 'graphql', importance: 'REQUIRED' },
    { name: 'React', importance: 'REQUIRED' },
  ],
  strengths: ['A', 'A'],
  gaps: [],
  suggestions: ['Do X'],
  ...overrides,
});

describe('toAnalysisResult', () => {
  it('trims, de-duplicates and orders the answer', () => {
    const { jobTitle, company, result } = toAnalysisResult(match());
    expect(jobTitle).toBe('Senior Frontend Engineer');
    expect(company).toBeNull();
    expect(result).toEqual({
      score: 72,
      summary: 'Good fit.',
      matchedSkills: ['React', 'TypeScript'],
      // Required first; a skill listed as matched can't also be missing.
      missingSkills: [
        { name: 'GraphQL', importance: 'REQUIRED' },
        { name: 'Playwright', importance: 'NICE_TO_HAVE' },
      ],
      strengths: ['A'],
      gaps: [],
      suggestions: ['Do X'],
      sources: [],
    });
  });
});
