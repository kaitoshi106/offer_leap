import { describe, expect, it } from 'vitest';

import { answerQuestionSchema, createInterviewSchema } from './index';

describe('createInterviewSchema', () => {
  const valid = { jobTitle: ' Frontend Engineer ', type: 'MIXED', questionCount: 5, locale: 'vi' };

  it('accepts a job title, type, number of questions and locale', () => {
    expect(createInterviewSchema.parse({ ...valid, jobDescription: '' })).toEqual({
      jobTitle: 'Frontend Engineer',
      jobDescription: null,
      type: 'MIXED',
      questionCount: 5,
      locale: 'vi',
    });
  });

  it.each([
    [{ questionCount: 2 }, 'questionCount', 'tooSmall'],
    [{ questionCount: 11 }, 'questionCount', 'tooLarge'],
    [{ questionCount: 4.5 }, 'questionCount', 'invalid'],
    [{ jobTitle: 'x' }, 'jobTitle', 'tooShort'],
    [{ type: undefined }, 'type', 'required'],
  ])('rejects %o', (override, field, rule) => {
    const issue = createInterviewSchema.safeParse({ ...valid, ...override }).error?.issues[0];
    expect(issue).toMatchObject({ path: [field], message: rule });
  });
});

describe('answerQuestionSchema', () => {
  it('needs a non-blank answer', () => {
    expect(answerQuestionSchema.parse({ answer: '  I led the migration.  ' })).toEqual({
      answer: 'I led the migration.',
    });
    expect(answerQuestionSchema.safeParse({ answer: '   ' }).error?.issues[0]?.message).toBe('required');
  });
});
