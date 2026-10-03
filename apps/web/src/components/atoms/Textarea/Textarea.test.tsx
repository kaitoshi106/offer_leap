import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a multi-line textbox with the invalid state', () => {
    render(<Textarea aria-label="Job description" invalid />);
    const textarea = screen.getByRole('textbox', { name: 'Job description' });

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });
});
