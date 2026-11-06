import { describe, expect, it } from 'vitest';

import { COLLAPSE, collapseDivider, DEMO_MATCH, holdOnStageCue, scoreMatch, step } from './demo';

describe('scoreMatch', () => {
  it('scores the share of required skills the CV meets and bands it like the app', () => {
    expect(scoreMatch(['react', 'jest'], ['react', 'jest', 'graphql', 'playwright'])).toEqual({
      matched: ['react', 'jest'],
      missing: ['graphql', 'playwright'],
      score: 50,
      level: 'FAIR',
    });
  });

  it('gives 0 for a job with no required skills', () => {
    expect(scoreMatch(['react'], []).score).toBe(0);
  });

  it('computes the sample shown on the page instead of hard-coding it', () => {
    expect(DEMO_MATCH.score).toBe(75);
    expect(DEMO_MATCH.missing).toEqual(['graphql', 'playwright']);
    expect(DEMO_MATCH.level).toBe('GOOD');
  });
});

describe('step', () => {
  it('is 0 before, 1 after and eased in between', () => {
    expect(step(0, 0.2, 0.6)).toBe(0);
    expect(step(1, 0.2, 0.6)).toBe(1);
    expect(step(0.4, 0.2, 0.6)).toBeCloseTo(0.5);
  });
});

describe('collapseDivider', () => {
  it('holds half and half before the sweep and is gone after it', () => {
    expect(collapseDivider(0, false)).toBe(0.5);
    expect(collapseDivider(COLLAPSE.from, false)).toBe(0.5);
    expect(collapseDivider(COLLAPSE.to, false)).toBe(0);
  });

  it('travels during the sweep, but changes in one step with reduced motion', () => {
    const middle = (COLLAPSE.from + COLLAPSE.to) / 2;
    expect(collapseDivider(middle - 0.05, false)).toBeGreaterThan(0);
    expect(collapseDivider(middle - 0.05, false)).toBeLessThan(0.5);
    expect(collapseDivider(middle - 0.05, true)).toBe(0.5);
    expect(collapseDivider(middle, true)).toBe(0);
  });
});

describe('holdOnStageCue', () => {
  it('never starts fading before the act is over (progress stays at 1 during the exit slide)', () => {
    const [from, to, rampIn, rampOut] = holdOnStageCue(0.24, 0.06).split(' ').map(Number);
    expect(from).toBe(0.24);
    expect(rampIn).toBe(0.06);
    // The fade-out would start at `to - window * rampOut`; it must lie beyond the largest progress, 1.
    expect(to! - (to! - from!) * rampOut!).toBeGreaterThan(1);
  });
});
