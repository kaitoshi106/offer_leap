import { describe, expect, it } from 'vitest';

import { pageQuerySchema } from './index';

describe('pageQuerySchema', () => {
  it('defaults to the first page of 10 and accepts only the offered sizes', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(pageQuerySchema.parse({ page: '3', pageSize: '100' })).toEqual({ page: 3, pageSize: 100 });
    expect(pageQuerySchema.safeParse({ pageSize: '20' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
