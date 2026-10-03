import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './Icon';

describe('Icon', () => {
  it('is decorative by default', () => {
    const { container } = render(<Icon name="sun" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes an image with an accessible name when labelled', () => {
    render(<Icon name="alert-circle" label="Error" />);
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
  });
});
