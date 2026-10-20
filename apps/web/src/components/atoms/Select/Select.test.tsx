import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Select } from './Select';

describe('Select', () => {
  it('starts on a disabled placeholder and selects an option', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Level" placeholder="Choose a level" defaultValue="" invalid>
        <option value="JUNIOR">Junior</option>
        <option value="SENIOR">Senior</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Level' });

    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Choose a level' })).toBeDisabled();
    expect(select).toHaveAttribute('aria-invalid', 'true');

    await user.selectOptions(select, 'SENIOR');
    expect(select).toHaveValue('SENIOR');
  });
});

describe('Select layout', () => {
  it('puts layout classes on the wrapper so the chevron follows the width', () => {
    render(
      <Select aria-label="Period" wrapperClassName="w-44" className="h-9">
        <option>7</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Period' });
    expect(select.parentElement).toHaveClass('w-44');
    expect(select).toHaveClass('h-9');
  });
});
