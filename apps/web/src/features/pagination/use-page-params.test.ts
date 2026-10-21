import { describe, expect, it } from 'vitest';

import { toPageSize } from './use-page-params';

describe('toPageSize', () => {
  it('keeps offered sizes and falls back to the default for anything else', () => {
    expect(toPageSize('50')).toBe(50);
    expect(toPageSize('100')).toBe(100);
    expect(toPageSize('20')).toBe(10);
    expect(toPageSize(null)).toBe(10);
  });
});
