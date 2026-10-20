import { screen } from '@testing-library/react';
import type * as Navigation from 'next/navigation';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AcceptInvitationForm } from './AcceptInvitationForm';

const redirect = vi.fn();
let searchParams = new URLSearchParams('token=invitation-token-1234567890');
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useSearchParams: () => searchParams,
}));
vi.mock('@/lib/auth-redirect', () => ({ useAuthRedirect: () => redirect }));

const fetchMock = vi.fn<typeof fetch>();

describe('AcceptInvitationForm', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    redirect.mockReset();
    searchParams = new URLSearchParams('token=invitation-token-1234567890');
    vi.unstubAllGlobals();
  });

  it('shows the invited email, creates the account and opens the admin console', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { email: 'lan@example.com', expiresAt: '2026-10-22T00:00:00.000Z' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { user: {}, accessTokenExpiresAt: '2026-10-20T00:15:00.000Z' }),
      );
    renderWithProviders(<AcceptInvitationForm />);

    expect(await screen.findByDisplayValue('lan@example.com')).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText(/^Họ và tên/), 'Lan Nguyễn');
    await user.type(screen.getByLabelText(/^Mật khẩu/), 'leap2026');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith('/admin/users'));
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      fullName: 'Lan Nguyễn',
      password: 'leap2026',
      token: 'invitation-token-1234567890',
    });
  });

  it('explains an expired link', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { statusCode: 400, code: 'AUTH_TOKEN_EXPIRED', message: 'expired' }),
    );
    renderWithProviders(<AcceptInvitationForm />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới. Hãy nhờ quản trị viên gốc gửi lại lời mời.',
    );
  });

  it('needs a token', () => {
    searchParams = new URLSearchParams();
    renderWithProviders(<AcceptInvitationForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Liên kết mời không hợp lệ.');
  });
});
