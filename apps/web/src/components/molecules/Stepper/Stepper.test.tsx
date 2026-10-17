import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('marks the current step and announces finished ones', () => {
    render(
      <Stepper
        label="Progress"
        completedLabel="(completed)"
        current={1}
        steps={[
          { key: 'a', label: 'Personal' },
          { key: 'b', label: 'Career' },
          { key: 'c', label: 'Review' },
        ]}
      />,
    );
    const items = within(screen.getByRole('navigation', { name: 'Progress' })).getAllByRole('listitem');

    expect(items[0]).toHaveTextContent('Personal (completed)');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });
});
