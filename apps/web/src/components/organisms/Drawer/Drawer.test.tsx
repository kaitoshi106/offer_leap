import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open menu</button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        label="Menu"
        closeLabel="Close menu"
        header={<span>OfferLeap</span>}
        footer={<button>Sign out</button>}
      >
        <a href="#analyses">Analyses</a>
        <p>Settings</p>
        <div data-drawer-keep-open>
          <a href="#en">English</a>
        </div>
      </Drawer>
    </>
  );
}

const drawer = () => screen.getByRole('dialog', { hidden: true });
/** Closing plays the slide-out first (in jsdom no animation runs, so the fallback timer closes it). */
const closed = () => vi.waitFor(() => expect(drawer()).not.toHaveAttribute('open'));

describe('Drawer', () => {
  it('opens as a labelled modal with its header, content and footer, and locks page scrolling', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('dialog', { name: 'Menu' })).toHaveAttribute('open');
    expect(screen.getByText('OfferLeap')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    await closed();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes on Escape, on the backdrop and when a link inside is followed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const open = () => user.click(screen.getByRole('button', { name: 'Open menu' }));

    await open();
    fireEvent(drawer(), new Event('cancel', { cancelable: true }));
    await closed();

    await open();
    await user.click(drawer());
    await closed();

    await open();
    await user.click(screen.getByRole('link', { name: 'Analyses' }));
    await closed();

    // Clicking plain content, or a link marked to keep it open (language), keeps it open.
    await open();
    await user.click(screen.getByText('Settings'));
    await user.click(screen.getByRole('link', { name: 'English' }));
    expect(drawer()).toHaveAttribute('open');
  });

  afterEach(() => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never,
    );
  });

  it('plays the slide-out before closing, or closes at once with reduced motion', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    // Still open while the exit animation runs.
    expect(drawer()).toHaveAttribute('open');
    expect(drawer()).toHaveAttribute('data-closing');
    await closed();
    expect(drawer()).not.toHaveAttribute('data-closing');

    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as never,
    );
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(drawer()).not.toHaveAttribute('open');
  });

  it('finishes closing once: the slide-out and the backdrop fade both end, then the fallback timer fires', async () => {
    const user = userEvent.setup();
    const afterClose = vi.fn();
    function WithAfterClose() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          label="Menu"
          closeLabel="Close menu"
          onAfterClose={afterClose}
        >
          <p>Content</p>
        </Drawer>
      );
    }
    render(<WithAfterClose />);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));

    // Both animations target the dialog (the ::backdrop has no element of its own).
    fireEvent(drawer(), new Event('animationend'));
    fireEvent(drawer(), new Event('animationend'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(afterClose).toHaveBeenCalledOnce();
  });

  it('keeps the page from scrolling until the slide-out is over, without shifting it sideways', async () => {
    const user = userEvent.setup();
    // A classic 15px scrollbar: the page would widen by that much when scrolling is locked.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(window.innerWidth - 15);
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.paddingRight).toBe('15px');

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    // Still sliding out: still locked.
    expect(document.documentElement.style.overflow).toBe('hidden');
    await closed();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.style.paddingRight).toBe('');
    vi.restoreAllMocks();
  });
});
