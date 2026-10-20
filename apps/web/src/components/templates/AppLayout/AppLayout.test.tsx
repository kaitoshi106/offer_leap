import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AppLayout, navLinkClasses } from './AppLayout';

// The header's language switcher builds links for the current path.
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/dashboard',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale: string }) => (
    <a href={`/${locale}${href}`} {...rest} />
  ),
}));

describe('AppLayout', () => {
  it('renders a labelled navigation, the actions and the main content', () => {
    renderWithProviders(
      <AppLayout
        navLabel="Main navigation"
        nav={
          <li>
            <a href="#overview" aria-current="page" className={navLinkClasses(true)}>
              Overview
            </a>
          </li>
        }
        actions={<button type="button">Sign out</button>}
      >
        <h1>Hello</h1>
      </AppLayout>,
    );

    // Desktop and mobile copies of the nav both exist (one hidden by CSS).
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Overview' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Hello');
  });
});
