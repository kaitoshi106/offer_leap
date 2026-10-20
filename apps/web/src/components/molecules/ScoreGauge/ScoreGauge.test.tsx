import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreGauge } from './ScoreGauge';

describe('ScoreGauge', () => {
  it('is a meter with a readable value', () => {
    render(
      <ScoreGauge score={72} label="Match score" valueText="72 out of 100, good match" tone="primary" />,
    );
    const meter = screen.getByRole('meter', { name: 'Match score' });
    expect(meter).toHaveAttribute('aria-valuenow', '72');
    expect(meter).toHaveAttribute('aria-valuetext', '72 out of 100, good match');
    expect(meter).toHaveTextContent('72');
  });

  it('clamps and rounds the score', () => {
    render(<ScoreGauge score={140.6} label="Score" valueText="max" tone="success" />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });
});
