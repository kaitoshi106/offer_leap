import { describe, expect, it } from 'vitest';

import { createApplicationSchema, moveApplicationSchema, updateApplicationSchema } from './index';

describe('createApplicationSchema', () => {
  it('trims, defaults the column to SAVED and stores empty optionals as null', () => {
    expect(
      createApplicationSchema.parse({
        company: ' Acme ',
        jobTitle: ' Frontend Engineer ',
        jobUrl: '',
        jobDescription: '  ',
      }),
    ).toEqual({
      company: 'Acme',
      jobTitle: 'Frontend Engineer',
      jobUrl: null,
      jobDescription: null,
      status: 'SAVED',
    });
  });

  it.each([
    ['company', { company: '', jobTitle: 'Dev' }, 'required'],
    ['jobUrl', { company: 'Acme', jobTitle: 'Dev', jobUrl: 'javascript:alert(1)' }, 'invalid'],
    ['jobUrl', { company: 'Acme', jobTitle: 'Dev', jobUrl: 'acme.com/jobs' }, 'invalid'],
    ['status', { company: 'Acme', jobTitle: 'Dev', status: 'GHOSTED' }, undefined],
  ])('rejects a bad %s', (field, input, rule) => {
    const issue = createApplicationSchema.safeParse(input).error?.issues[0];
    expect(issue?.path).toEqual([field]);
    if (rule) expect(issue?.message).toBe(rule);
  });
});

describe('updateApplicationSchema', () => {
  it('accepts a partial update and clears a field with an empty string', () => {
    expect(updateApplicationSchema.parse({ notes: '' })).toEqual({ notes: null });
    expect(updateApplicationSchema.parse({})).toEqual({});
  });
});

describe('moveApplicationSchema', () => {
  it('needs a known column and a finite position', () => {
    expect(moveApplicationSchema.parse({ status: 'INTERVIEW', position: 1.5 })).toEqual({
      status: 'INTERVIEW',
      position: 1.5,
    });
    expect(moveApplicationSchema.safeParse({ status: 'INTERVIEW', position: Infinity }).success).toBe(false);
  });
});
