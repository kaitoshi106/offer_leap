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

  it('keeps step names readable by screen readers on phones and shows where the user is', () => {
    render(
      <Stepper
        label="Progress"
        completedLabel="(completed)"
        skippedLabel="(skipped)"
        currentLabel="Step 2 of 3: Career"
        current={1}
        steps={[
          { key: 'a', label: 'CV', skipped: true },
          { key: 'b', label: 'Career' },
          { key: 'c', label: 'Review' },
        ]}
      />,
    );
    const items = within(screen.getByRole('navigation', { name: 'Progress' })).getAllByRole('listitem');

    // Names are visually hidden on phones (`sr-only`), never removed (`hidden` would drop them for everyone).
    expect(within(items[1]!).getByText('Career')).not.toHaveClass('hidden');
    expect(within(items[1]!).getByText('Career')).toHaveClass('sr-only', 'sm:not-sr-only');
    // A step that was passed over is not announced as done.
    expect(items[0]).toHaveTextContent('CV (skipped)');
    expect(items[0]).not.toHaveTextContent('(completed)');
    // Phones get a short caption instead of the names.
    expect(screen.getByText('Step 2 of 3: Career')).toHaveClass('sm:hidden');
  });
});
