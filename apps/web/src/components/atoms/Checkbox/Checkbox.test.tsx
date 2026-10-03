import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('toggles with click and the space key', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Remote" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Remote' });

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
  });

  it('reflects the indeterminate state', () => {
    render(<Checkbox aria-label="Select all" indeterminate />);
    expect(screen.getByRole('checkbox')).toBePartiallyChecked();
  });

  it('forwards refs to the native input', () => {
    let node: HTMLInputElement | null = null;
    render(<Checkbox aria-label="Remote" ref={(el) => void (node = el)} />);
    expect(node).toBeInstanceOf(HTMLInputElement);
  });
});
