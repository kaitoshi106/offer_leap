import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesWarning } from './use-unsaved-changes-warning';

function Page({ dirty, onNavigate }: { dirty: boolean; onNavigate: () => void }) {
  useUnsavedChangesWarning(dirty, 'Leave without saving?');
  return (
    <>
      <a
        href="#board"
        onClick={(event) => {
          event.preventDefault();
          onNavigate();
        }}
      >
        Board
      </a>
      <a href="https://example.com/job" target="_blank" rel="noreferrer">
        Job posting
      </a>
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useUnsavedChangesWarning', () => {
  it('asks before following a link while there are unsaved changes, and stays if the user cancels', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const navigate = vi.fn();
    render(<Page dirty onNavigate={navigate} />);

    await userEvent.click(screen.getByRole('link', { name: 'Board' }));

    expect(confirm).toHaveBeenCalledWith('Leave without saving?');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('follows the link when the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const navigate = vi.fn();
    render(<Page dirty onNavigate={navigate} />);

    await userEvent.click(screen.getByRole('link', { name: 'Board' }));

    expect(navigate).toHaveBeenCalledOnce();
  });

  it('does not ask without unsaved changes, nor for links that open in a new tab', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const navigate = vi.fn();
    const { rerender } = render(<Page dirty={false} onNavigate={navigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Board' }));
    expect(navigate).toHaveBeenCalledOnce();

    rerender(<Page dirty onNavigate={navigate} />);
    screen
      .getByRole('link', { name: 'Job posting' })
      .addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(screen.getByRole('link', { name: 'Job posting' }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks the browser to confirm closing or reloading the tab while there are unsaved changes', () => {
    const { rerender } = render(<Page dirty onNavigate={vi.fn()} />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender(<Page dirty={false} onNavigate={vi.fn()} />);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });
});
