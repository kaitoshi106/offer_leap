import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('announces its label as a status', () => {
    render(<Spinner label="Reading your CV…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reading your CV…');
  });

  it('renders silently when the label is null', () => {
    render(<Spinner label={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
