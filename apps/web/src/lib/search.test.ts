import { describe, expect, it } from 'vitest';

import { foldForSearch } from './search';

describe('foldForSearch', () => {
  it.each([
    ['Hà Nội', 'ha noi'],
    ['Đà Nẵng', 'da nang'],
    ['  TP. Hồ Chí Minh ', 'tp. ho chi minh'],
    ['Đắk Lắk', 'dak lak'],
  ])('%s → %s', (input, expected) => {
    expect(foldForSearch(input)).toBe(expected);
  });
});
