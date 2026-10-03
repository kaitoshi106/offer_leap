import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Text } from './Text';

describe('Text', () => {
  it('renders the requested element and tone', () => {
    render(
      <Text as="span" tone="muted">
        Hint
      </Text>,
    );
    const text = screen.getByText('Hint');

    expect(text.tagName).toBe('SPAN');
    expect(text).toHaveClass('text-fg-muted');
  });
});
