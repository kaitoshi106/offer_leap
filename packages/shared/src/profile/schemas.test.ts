import { describe, expect, it } from 'vitest';

import { toFieldErrors } from '../validation/field-errors';
import {
  careerStepSchema,
  completeOnboardingSchema,
  personalStepSchema,
  preferencesStepSchema,
} from './schemas';

const rules = (result: { success: boolean; error?: { issues: unknown[] } }) =>
  toFieldErrors((result.error?.issues ?? []) as never).map(({ field, rule, params }) => ({
    field,
    rule,
    params,
  }));

describe('personalStepSchema', () => {
  it('normalises a Vietnamese phone number and accepts an empty one', () => {
    expect(
      personalStepSchema.parse({ fullName: 'Minh', phone: '0912 345 678', provinceCode: 'ha-noi' }).phone,
    ).toBe('0912345678');
    for (const phone of ['+84.912.345.678', '84 912 345 678', '(+84) 912-345-678']) {
      expect(personalStepSchema.parse({ fullName: 'Minh', phone, provinceCode: 'ha-noi' }).phone).toBe(
        '0912345678',
      );
    }
    expect(
      personalStepSchema.safeParse({ fullName: 'Minh', phone: '', provinceCode: 'ha-noi' }).success,
    ).toBe(true);
  });

  it.each(['12345', '0912abc678', '+1 415 555 0100', '849123456789'])('rejects the phone %s', (phone) => {
    expect(rules(personalStepSchema.safeParse({ fullName: 'Minh', phone, provinceCode: 'ha-noi' }))).toEqual([
      { field: 'phone', rule: 'invalidPhone', params: undefined },
    ]);
  });

  it('rejects a malformed phone and a missing province', () => {
    expect(
      rules(personalStepSchema.safeParse({ fullName: 'Minh', phone: '12345', provinceCode: '' })),
    ).toEqual([
      { field: 'phone', rule: 'invalidPhone', params: undefined },
      { field: 'provinceCode', rule: 'required', params: { min: 1 } },
    ]);
  });
});

describe('careerStepSchema', () => {
  const valid = {
    industryCode: 'software',
    jobTitle: 'Frontend Developer',
    level: 'SENIOR',
    yearsOfExperience: 6,
    skills: ['React'],
  };

  it('de-duplicates skills case-insensitively', () => {
    expect(careerStepSchema.parse({ ...valid, skills: ['React', 'react', ' NestJS '] }).skills).toEqual([
      'React',
      'NestJS',
    ]);
  });

  it('says a fractional number of years must be a whole number, not just "invalid"', () => {
    expect(rules(careerStepSchema.safeParse({ ...valid, yearsOfExperience: 2.5 }))).toEqual([
      { field: 'yearsOfExperience', rule: 'wholeNumber', params: undefined },
    ]);
  });

  it('reports translatable rules with limits', () => {
    expect(rules(careerStepSchema.safeParse({ ...valid, yearsOfExperience: 70, skills: [] }))).toEqual([
      { field: 'yearsOfExperience', rule: 'tooLarge', params: { max: 50 } },
      { field: 'skills', rule: 'tooFew', params: { min: 1 } },
    ]);
  });
});

describe('preferencesStepSchema', () => {
  it('requires at least one work type and a coherent salary range, reporting both at once', () => {
    expect(
      rules(preferencesStepSchema.safeParse({ expectedSalaryMin: 40, expectedSalaryMax: 20, workTypes: [] })),
    ).toEqual([
      { field: 'workTypes', rule: 'tooFew', params: { min: 1 } },
      { field: 'expectedSalaryMax', rule: 'minExceedsMax', params: undefined },
    ]);
  });

  it('allows leaving salary empty', () => {
    expect(preferencesStepSchema.safeParse({ workTypes: ['HYBRID'] }).success).toBe(true);
  });
});

describe('completeOnboardingSchema', () => {
  it('needs every step', () => {
    const result = completeOnboardingSchema.safeParse({ fullName: 'Minh', provinceCode: 'ha-noi' });
    expect(rules(result).map((error) => error.field)).toEqual(
      expect.arrayContaining([
        'industryCode',
        'jobTitle',
        'level',
        'yearsOfExperience',
        'skills',
        'workTypes',
      ]),
    );
  });
});

describe('updateProfileSectionSchema', () => {
  it('validates the values of the chosen section with the onboarding rules', async () => {
    const { updateProfileSectionSchema } = await import('./schemas');
    expect(
      updateProfileSectionSchema.parse({
        section: 'personal',
        values: { fullName: 'Minh', phone: '+84 912 345 678', provinceCode: 'ha-noi' },
      }),
    ).toEqual({
      section: 'personal',
      values: { fullName: 'Minh', phone: '0912345678', provinceCode: 'ha-noi' },
    });
    expect(updateProfileSectionSchema.safeParse({ section: 'career', values: { skills: [] } }).success).toBe(
      false,
    );
    expect(updateProfileSectionSchema.safeParse({ section: 'resume', values: {} }).success).toBe(false);
  });
});
