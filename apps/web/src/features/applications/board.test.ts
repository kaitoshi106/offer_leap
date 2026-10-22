import type { ApplicationSummary } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import { dropBeforeId, dropPosition, positionBetween, toColumns } from './board';

const card = (id: string, status: ApplicationSummary['status'], position: number): ApplicationSummary => ({
  id,
  company: 'Acme',
  jobTitle: id,
  status,
  position,
  score: null,
  hasCoverLetter: false,
  updatedAt: '2026-10-20T00:00:00.000Z',
});

describe('positionBetween', () => {
  it.each([
    [1, 2, 1.5],
    [undefined, 2, 1],
    [1, undefined, 2],
    [undefined, undefined, 0],
  ])('between %s and %s is %s', (before, after, expected) => {
    expect(positionBetween(before, after)).toBe(expected);
  });
});

describe('toColumns', () => {
  it('groups by status and sorts by position', () => {
    const columns = toColumns([card('b', 'SAVED', 2), card('x', 'OFFER', 0), card('a', 'SAVED', -1)]);
    expect(columns.SAVED.map((c) => c.id)).toEqual(['a', 'b']);
    expect(columns.OFFER.map((c) => c.id)).toEqual(['x']);
    expect(columns.APPLIED).toEqual([]);
  });
});

describe('dropPosition', () => {
  const column = [card('a', 'SAVED', 0), card('b', 'SAVED', 1), card('c', 'SAVED', 2)];

  it('lands above the card it is dropped on', () => {
    expect(dropPosition(column, 'x', 'b')).toBe(0.5);
    expect(dropPosition(column, 'x', 'a')).toBe(-1);
  });

  it('goes to the end when dropped on empty space', () => {
    expect(dropPosition(column, 'x')).toBe(3);
    expect(dropPosition([], 'x')).toBe(0);
  });

  it('ignores the moved card itself (reordering inside a column)', () => {
    expect(dropPosition(column, 'a', 'c')).toBe(1.5);
  });
});

describe('dropBeforeId', () => {
  const column = ['a', 'b', 'c'];

  it('lands above the hovered card on its upper half, below it on its lower half', () => {
    expect(dropBeforeId(column, 'b', false, 'x')).toBe('b');
    expect(dropBeforeId(column, 'b', true, 'x')).toBe('c');
    expect(dropBeforeId(column, 'c', true, 'x')).toBeUndefined();
  });

  it('skips the dragged card itself', () => {
    // Dragging "a" over the lower half of "b": lands before "c", not before "a".
    expect(dropBeforeId(column, 'b', true, 'a')).toBe('c');
    // Hovering the dragged card keeps it in place (before its current next card).
    expect(dropBeforeId(column, 'b', false, 'b')).toBe('c');
    expect(dropBeforeId(column, 'c', true, 'c')).toBeUndefined();
  });
});
