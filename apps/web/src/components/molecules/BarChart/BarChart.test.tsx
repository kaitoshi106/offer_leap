import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarChart } from './BarChart';

const data = [
  { label: '18/10', value: 4, highlight: 1 },
  { label: '19/10', value: 0 },
  { label: '20/10', value: 8 },
];

describe('BarChart', () => {
  it('is an image named by its title and summary, with bars scaled to the maximum', () => {
    const { container } = render(
      <BarChart
        data={data}
        title="AI calls"
        summary="12 calls, peak 8"
        columns={['Day', 'Calls', 'Failed']}
      />,
    );
    expect(screen.getByRole('img', { name: 'AI calls. 12 calls, peak 8' })).toBeInTheDocument();
    const bars = container.querySelectorAll<HTMLElement>('[role="img"] > div > div');
    expect([...bars].map((bar) => bar.style.height)).toEqual(['50%', '0%', '100%']);
  });

  it('exposes every value in a hidden table', () => {
    render(<BarChart data={data} title="AI calls" summary="…" columns={['Day', 'Calls', 'Failed']} />);
    const table = screen.getByRole('table', { name: 'AI calls' });
    const first = within(table).getAllByRole('row')[1]!;
    expect(first).toHaveTextContent('18/1041');
  });
});
