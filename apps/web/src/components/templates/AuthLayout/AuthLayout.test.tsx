import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AuthLayout } from './AuthLayout';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/login',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale?: string }) => (
    <a href={`/${locale ?? 'vi'}${href}`} {...rest} />
  ),
}));

describe('AuthLayout', () => {
  it('renders the page content and hides the decorative showcase from assistive tech', () => {
    renderWithProviders(
      <AuthLayout
        title="Đăng nhập"
        homeLabel="Về trang chủ"
        highlights={[{ icon: 'target', text: 'Chấm CV theo JD' }]}
        showcase={{ matchLabel: 'Độ phù hợp với JD', aiLabel: 'AI đã điền hồ sơ', skills: ['React'] }}
      >
        <p>Form</p>
      </AuthLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByText('Chấm CV theo JD')).toBeVisible();
    // Decorative cards stay in the DOM for sighted users but are not exposed as content.
    expect(screen.getByText('Độ phù hợp với JD').closest('[aria-hidden]')).not.toBeNull();
    expect(screen.queryByRole('img', { name: /92/ })).not.toBeInTheDocument();
  });
});
