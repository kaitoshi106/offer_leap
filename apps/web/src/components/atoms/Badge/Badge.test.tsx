import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its label with the tone classes', () => {
    render(<Badge tone="ai">AI suggested</Badge>);
    expect(screen.getByText('AI suggested')).toHaveClass('bg-ai-soft');
  });
});
