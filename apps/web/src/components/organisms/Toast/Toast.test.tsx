import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';

function Trigger({ tone }: { tone?: 'success' | 'danger' }) {
  const toast = useToast();
  return <button onClick={() => toast.show({ tone, title: 'Saved', description: 'All good' })}>Show</button>;
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces a toast and removes it after its duration', () => {
    render(
      <ToastProvider dismissLabel="Dismiss">
        <Trigger tone="success" />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Show' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('SavedAll good');

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses role="alert" for errors and can be dismissed', () => {
    render(
      <ToastProvider dismissLabel="Dismiss">
        <Trigger tone="danger" />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Show' }).click());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'Dismiss' }).click());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
