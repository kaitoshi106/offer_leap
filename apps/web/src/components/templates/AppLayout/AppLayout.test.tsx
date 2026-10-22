import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AppLayout, navLinkClasses } from './AppLayout';

// The header's language switcher builds links for the current path.
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/dashboard',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale: string }) => (
    <a href={`/${locale}${href}`} {...rest} />
  ),
}));

const MENU = {
  open: 'Open menu',
  close: 'Close menu',
  title: 'Menu',
  language: 'Language',
  theme: 'Appearance',
};
const overview = (
  <li>
    <a href="#overview" aria-current="page" className={navLinkClasses(true)}>
      Overview
    </a>
  </li>
);

describe('AppLayout', () => {
  it('renders a labelled navigation, the actions and the main content', () => {
    renderWithProviders(
      <AppLayout navLabel="Main navigation" nav={overview} actions={<button type="button">Sign out</button>}>
        <h1>Hello</h1>
      </AppLayout>,
    );

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Hello');
    // No menu texts, no phone menu.
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('on phones, puts the navigation, the switches and the account in a drawer', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppLayout
        navLabel="Main navigation"
        nav={overview}
        menuLabels={MENU}
        menuFooter={<a href="#settings">Account settings</a>}
      >
        <h1>Hello</h1>
      </AppLayout>,
    );

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveTextContent('Overview');
    expect(drawer).toHaveTextContent('Language');
    expect(drawer).toHaveTextContent('Appearance');
    expect(drawer).toHaveTextContent('Account settings');

    // Following a link closes the menu.
    await user.click(screen.getByRole('link', { name: 'Account settings' }));
    await vi.waitFor(() => expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open'));
  });

  afterEach(() => sessionStorage.clear());

  it('keeps the menu open across a language switch: it reopens at once on the new page', async () => {
    const user = userEvent.setup();
    const layout = () => (
      <AppLayout navLabel="Main navigation" nav={overview} menuLabels={MENU}>
        <h1>Hello</h1>
      </AppLayout>
    );
    const first = renderWithProviders(layout());
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    // The other language is a link; following it must not close the menu…
    await user.click(within(menu).getByRole('link', { name: /English/ }));
    expect(menu).toHaveAttribute('open');
    expect(sessionStorage.getItem('offerleap:menu-reopen')).not.toBeNull();

    // …and the page that loads in that language opens it again, without the slide-in.
    first.unmount();
    renderWithProviders(layout());
    const reopened = await screen.findByRole('dialog', { name: 'Menu' });
    expect(reopened).toHaveAttribute('open');
    expect(reopened.className).not.toMatch(/animate-drawer-in/);
    expect(sessionStorage.getItem('offerleap:menu-reopen')).toBeNull();
  });

  it('ignores a stale reopen note', () => {
    sessionStorage.setItem('offerleap:menu-reopen', String(Date.now() - 60_000));
    renderWithProviders(
      <AppLayout navLabel="Main navigation" nav={overview} menuLabels={MENU}>
        <h1>Hello</h1>
      </AppLayout>,
    );
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });
});
