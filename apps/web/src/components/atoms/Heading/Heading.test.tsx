import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Heading } from './Heading';

describe('Heading', () => {
  it('keeps the semantic level independent from the visual size', () => {
    render(
      <Heading level={2} size="2xl">
        Title
      </Heading>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Title' });

    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveClass('text-4xl');
  });
});
