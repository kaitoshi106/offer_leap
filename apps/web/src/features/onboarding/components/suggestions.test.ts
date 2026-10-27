import type { ProfileValues, ResumeSummary } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import { suggestedFields } from './suggestions';

const resume = (overrides: Partial<ResumeSummary> = {}): ResumeSummary => ({
  id: 'r1',
  fileName: 'cv.pdf',
  mimeType: 'application/pdf',
  status: 'COMPLETED',
  errorCode: null,
  createdAt: '2026-10-19T00:00:00.000Z',
  suggestions: {
    fullName: 'Nguyễn Văn An',
    phone: '0912345678',
    provinceCode: 'ha-noi',
    industryCode: 'software',
    jobTitle: null,
    level: 'SENIOR',
    yearsOfExperience: 0,
    skills: ['React', 'Next.js'],
    uncertainFields: ['level'],
  },
  ...overrides,
});

/** Draft as the API returns it after applying the CV. */
const applied: ProfileValues = {
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  provinceCode: 'ha-noi',
  industryCode: 'software',
  jobTitle: 'Developer',
  level: 'SENIOR',
  yearsOfExperience: 0,
  skills: ['React', 'Next.js'],
  expectedSalaryMin: null,
  expectedSalaryMax: null,
  workTypes: [],
};

describe('suggestedFields', () => {
  it('marks fields holding the CV values and flags the uncertain ones', () => {
    expect(suggestedFields(applied, resume())).toEqual({
      fullName: 'suggested',
      phone: 'suggested',
      provinceCode: 'suggested',
      industryCode: 'suggested',
      level: 'check',
      yearsOfExperience: 'suggested',
      skills: 'suggested',
    });
  });

  it('drops the mark once the user changes a value', () => {
    const edited = { ...applied, provinceCode: 'da-nang', skills: ['React', 'Next.js', 'Vue'] };
    const result = suggestedFields(edited, resume());
    expect(result).not.toHaveProperty('provinceCode');
    expect(result).not.toHaveProperty('skills');
    expect(result).toHaveProperty('phone', 'suggested');
  });

  it('ignores CVs that are still being read or failed', () => {
    expect(suggestedFields(applied, resume({ status: 'PROCESSING' }))).toEqual({});
    expect(suggestedFields(applied, null)).toEqual({});
  });
});
