import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './Label';

describe('Label', () => {
  it('shows a required marker hidden from assistive tech', () => {
    render(
      <>
        <Label htmlFor="name" required>
          Full name
        </Label>
        <input id="name" required />
      </>,
    );

    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeRequired();
  });
});
