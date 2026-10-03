import { screen } from '@testing-library/react';
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

describe('LocaleSwitcher', () => {
  it('links to the current page in the other language', () => {
    renderWithProviders(<LocaleSwitcher />, { locale: 'vi' });
    const link = screen.getByRole('link', { name: 'Switch to English' });

    expect(link).toHaveAttribute('href', '/en/onboarding');
    expect(link).toHaveAttribute('hreflang', 'en');
  });

  it('switches back to Vietnamese from English', () => {
    renderWithProviders(<LocaleSwitcher />, { locale: 'en' });
    expect(screen.getByRole('link', { name: 'Chuyển sang Tiếng Việt' })).toHaveAttribute(
      'href',
      '/vi/onboarding',
    );
  });
});
