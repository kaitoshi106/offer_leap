import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from './Alert';

describe('Alert', () => {
  it('uses role="alert" for errors and role="status" otherwise', () => {
    render(
      <>
        <Alert tone="danger" title="Failed">
          Try again
        </Alert>
        <Alert tone="success">Saved</Alert>
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('FailedTry again');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});
