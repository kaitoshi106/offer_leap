import { PROFILE_LIMITS } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import type { ResumeExtraction } from '../ai/prompts/resume-extraction.v2';
import { toResumeSuggestions } from './resume-suggestions';

const extraction = (overrides: Partial<ResumeExtraction> = {}): ResumeExtraction => ({
  fullName: '  Nguyễn Văn An ',
  phone: '0912.345.678',
  provinceCode: 'ha-noi',
  industryCode: 'software',
  jobTitle: 'Frontend Developer',
  level: 'SENIOR',
  yearsOfExperience: 6,
  skills: ['React', 'TypeScript'],
  uncertainFields: [],
  ...overrides,
});

describe('toResumeSuggestions', () => {
  it('cleans values with the onboarding rules', () => {
    const result = toResumeSuggestions(extraction());
    expect(result.fullName).toBe('Nguyễn Văn An');
    expect(result.phone).toBe('0912345678');
    expect(result).toMatchObject({ provinceCode: 'ha-noi', level: 'SENIOR', yearsOfExperience: 6 });
  });

  it('drops values the form would reject instead of showing them', () => {
    const result = toResumeSuggestions(
      extraction({ phone: '+1 (415) 555-0100', jobTitle: 'X', fullName: null }),
    );
    expect(result).toMatchObject({ phone: null, jobTitle: null, fullName: null });
  });

  it('de-duplicates skills case-insensitively and drops over-long ones', () => {
    const tooLong = 'x'.repeat(PROFILE_LIMITS.skillLength + 1);
    const result = toResumeSuggestions(extraction({ skills: ['React', ' react ', tooLong, '', 'Node.js'] }));
    expect(result.skills).toEqual(['React', 'Node.js']);
  });

  it('only flags uncertain fields that still hold a value', () => {
    const result = toResumeSuggestions(
      extraction({ phone: 'n/a', skills: [], uncertainFields: ['phone', 'skills', 'level', 'level'] }),
    );
    expect(result.uncertainFields).toEqual(['level']);
  });
});
