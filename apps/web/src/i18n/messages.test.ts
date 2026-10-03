import { ErrorCode } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

/**
 * @description Flattens nested messages into dot-path keys: `{ a: { b: 'x' } }` → `['a.b']`.
 * @param messages - Nested messages object.
 * @param prefix - Path of the current level.
 * @returns Sorted list of leaf keys.
 */
function flattenKeys(messages: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(messages)
    .flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'object' && value !== null
        ? flattenKeys(value as Record<string, unknown>, path)
        : [path];
    })
    .sort();
}

describe('messages', () => {
  it('vi and en define exactly the same keys', () => {
    expect(flattenKeys(en)).toEqual(flattenKeys(vi));
  });

  it.each(Object.values(ErrorCode))('translates error code %s in every locale', (code) => {
    expect(vi.errors).toHaveProperty(code);
    expect(en.errors).toHaveProperty(code);
  });

  it('has no empty translations', () => {
    for (const messages of [vi, en]) {
      const empty = flattenKeys(messages).filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty).toEqual([]);
    }
  });
});
