import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('toggles visibility without losing focus or value', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" showLabel="Show password" hideLabel="Hide password" />);
    const input = screen.getByLabelText('Password');

    await user.type(input, 'leap2026');
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('leap2026');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});
