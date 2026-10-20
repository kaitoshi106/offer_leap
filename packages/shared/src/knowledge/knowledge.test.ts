import { describe, expect, it } from 'vitest';

import { createTextDocumentSchema, knowledgeSearchSchema } from './index';

describe('createTextDocumentSchema', () => {
  it('trims and requires enough content', () => {
    expect(
      createTextDocumentSchema.parse({
        title: ' Dự án X ',
        content: '  Xây dựng hệ thống thanh toán bằng NestJS.  ',
      }),
    ).toEqual({ title: 'Dự án X', content: 'Xây dựng hệ thống thanh toán bằng NestJS.' });
    expect(
      createTextDocumentSchema.safeParse({ title: 'x', content: 'short' }).error?.issues[0]?.message,
    ).toBe('tooShort');
  });
});

describe('knowledgeSearchSchema', () => {
  it('coerces the limit from the query string', () => {
    expect(knowledgeSearchSchema.parse({ q: 'payments', limit: '3' })).toEqual({ q: 'payments', limit: 3 });
    expect(knowledgeSearchSchema.parse({ q: 'payments' }).limit).toBe(5);
    expect(knowledgeSearchSchema.safeParse({ q: 'payments', limit: '50' }).success).toBe(false);
  });
});
