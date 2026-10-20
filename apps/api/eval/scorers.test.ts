import { describe, expect, it } from 'vitest';

import { looksVietnamese, matches, percentile, scoreFields } from './scorers';

describe('matches', () => {
  it.each([
    ['exact string, ignoring case and spaces', 'Ha-Noi', ' ha-noi ', true],
    ['exact null', null, null, true],
    ['exact number', 6, 7, false],
    ['one of', { oneOf: ['JUNIOR', 'MIDDLE'] }, 'MIDDLE', true],
    ['range', { range: [8, 10] }, 9, true],
    ['range rejects non-numbers', { range: [0, 1] }, null, false],
    [
      'includes, ignoring case',
      { includes: ['react', 'TypeScript'] },
      ['React', 'typescript', 'Next.js'],
      true,
    ],
    ['includes misses an item', { includes: ['Go'] }, ['Node.js'], false],
    ['excludes', { excludes: ['react'] }, ['Go', 'Kubernetes'], true],
    ['alternative spellings', { includes: ['Go|Golang'] }, ['Golang', 'Docker'], true],
    ['whole words only', { includes: ['Go'] }, ['Google Ads'], false],
    ['words inside a longer name', { includes: ['Go'] }, ['Go (Golang)'], true],
    [
      'missing-skill objects',
      { includes: ['Kubernetes'] },
      [{ name: 'Kubernetes', importance: 'REQUIRED' }],
      true,
    ],
    ['not', { not: 'MANAGER' }, 'SENIOR', true],
  ] as const)('%s', (_case, expected, actual, result) => {
    expect(matches(expected as never, actual)).toBe(result);
  });
});

describe('scoreFields', () => {
  it('scores only the expected fields', () => {
    const results = scoreFields(
      { phone: '0912345678', level: { oneOf: ['SENIOR'] } },
      {
        phone: '0912345678',
        level: 'LEAD',
        extra: 'ignored',
      },
    );
    expect(results.map(({ field, pass }) => [field, pass])).toEqual([
      ['phone', true],
      ['level', false],
    ]);
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    expect(percentile(samples, 50)).toBe(500);
    expect(percentile(samples, 95)).toBe(1000);
    expect(percentile([], 95)).toBe(0);
  });
});

describe('looksVietnamese', () => {
  it('spots Vietnamese text', () => {
    expect(looksVietnamese('Ứng viên phù hợp với vị trí')).toBe(true);
    expect(looksVietnamese('The candidate fits the role')).toBe(false);
  });
});
