import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps content in the accessibility tree', () => {
    render(<VisuallyHidden>Opens in a new tab</VisuallyHidden>);
    expect(screen.getByText('Opens in a new tab')).toHaveClass('sr-only');
  });
});
