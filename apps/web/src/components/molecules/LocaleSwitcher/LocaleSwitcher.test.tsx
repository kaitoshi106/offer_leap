import { screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { LocaleSwitcher } from './LocaleSwitcher';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/onboarding',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale: string }) => (
    <a href={`/${locale}${href}`} {...rest} />
  ),
}));

const search = vi.hoisted(() => ({ current: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.current) }));

describe('LocaleSwitcher', () => {
  it('marks the current language and links to the other one for the same page', () => {
    renderWithProviders(<LocaleSwitcher />, { locale: 'vi' });
    const nav = screen.getByRole('navigation', { name: 'Ngôn ngữ' });

    const current = within(nav).getByText('Tiếng Việt').parentElement;
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(within(nav).queryByRole('link', { name: 'Tiếng Việt' })).not.toBeInTheDocument();

    const english = within(nav).getByRole('link', { name: 'English' });
    expect(english).toHaveAttribute('href', '/en/onboarding');
    expect(english).toHaveAttribute('hreflang', 'en');
  });

  it('shows the short codes visually', () => {
    renderWithProviders(<LocaleSwitcher />, { locale: 'en' });
    expect(screen.getByRole('navigation', { name: 'Language' })).toHaveTextContent(/VI.*EN/);
    expect(screen.getByRole('link', { name: 'Tiếng Việt' })).toHaveAttribute('href', '/vi/onboarding');
  });

  it('keeps the query string, so links with a token or a return path still work in the other language', () => {
    search.current = 'token=abc123&next=%2Fapplications%3Fid%3D1';
    try {
      renderWithProviders(<LocaleSwitcher />, { locale: 'vi' });
      expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
        'href',
        '/en/onboarding?token=abc123&next=%2Fapplications%3Fid%3D1',
      );
    } finally {
      search.current = '';
    }
  });
});
