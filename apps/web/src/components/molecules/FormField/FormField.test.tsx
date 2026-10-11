import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '../../atoms';
import { FormField } from './FormField';

describe('FormField', () => {
  it('labels the control and links the hint', () => {
    render(
      <FormField label="Email" hint="We never share it" required>
        {(field) => <Input {...field} />}
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Email' });

    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('announces the error, marks the control invalid and replaces the hint', () => {
    render(
      <FormField label="Email" hint="We never share it" error="Invalid email">
        {(field) => <Input {...field} />}
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Email' });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Invalid email');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });
});
