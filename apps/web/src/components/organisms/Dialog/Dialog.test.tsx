import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Dialog } from './Dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete CV</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this CV?"
        description="This can't be undone."
        closeLabel="Close"
      >
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('opens as a labelled, described dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Delete CV' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete this CV?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription("This can't be undone.");
  });

  it('closes with the close button, Escape (cancel) and a backdrop click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const open = () => user.click(screen.getByRole('button', { name: 'Delete CV' }));

    await open();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');

    await open();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');

    await open();
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('stays open when clicking inside the content', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Delete CV' }));
    await user.click(screen.getByText('Body'));

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });
});
