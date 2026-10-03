import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Radio } from './Radio';

describe('Radio', () => {
  it('keeps a single selection within a group', async () => {
    const user = userEvent.setup();
    render(
      <fieldset>
        <legend>Work type</legend>
        <Radio name="workType" value="onsite" aria-label="Onsite" />
        <Radio name="workType" value="remote" aria-label="Remote" />
      </fieldset>,
    );

    await user.click(screen.getByRole('radio', { name: 'Onsite' }));
    await user.click(screen.getByRole('radio', { name: 'Remote' }));

    expect(screen.getByRole('radio', { name: 'Remote' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Onsite' })).not.toBeChecked();
  });
});
