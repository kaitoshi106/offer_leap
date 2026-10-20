import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

const labels = (page: number, pages: number) => ({
  nav: 'Pagination',
  previous: 'Previous page',
  next: 'Next page',
  status: `Page ${page} of ${pages}`,
});

describe('Pagination', () => {
  it('moves between pages and disables the ends', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Pagination page={1} pages={3} onChange={onChange} labels={labels(1, 3)} />);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(2);

    rerender(<Pagination page={3} pages={3} onChange={onChange} labels={labels(3, 3)} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Page 3 of 3');
  });

  it('is hidden with a single page', () => {
    const { container } = render(<Pagination page={1} pages={1} onChange={vi.fn()} labels={labels(1, 1)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
