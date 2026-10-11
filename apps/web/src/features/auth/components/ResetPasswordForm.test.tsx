import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { ResetPasswordForm } from './ResetPasswordForm';

const replace = vi.fn();
let searchParams = new URLSearchParams('token=reset-token-1234567890');

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

const fetchMock = vi.fn<typeof fetch>();

describe('ResetPasswordForm', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    searchParams = new URLSearchParams('token=reset-token-1234567890');
  });

  it('requires both passwords to match before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'newleap2026');
    await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'different1');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByLabelText(/^Nhập lại mật khẩu/)).toHaveAccessibleDescription(
      'Mật khẩu nhập lại không khớp.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resets with the token from the link and goes to sign in', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'newleap2026');
    await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'newleap2026');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      token: 'reset-token-1234567890',
      password: 'newleap2026',
    });
  });

  it('explains when the link has no token', () => {
    searchParams = new URLSearchParams();
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Liên kết đặt lại mật khẩu không hợp lệ.');
  });
});
