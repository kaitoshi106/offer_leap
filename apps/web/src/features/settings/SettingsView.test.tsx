import type { AuthUser } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { SettingsView } from './SettingsView';

const fetchMock = vi.fn<typeof fetch>();

const me = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 'minh@example.com',
  fullName: 'Trần Minh',
  role: 'USER',
  adminLevel: null,
  locale: 'vi',
  emailVerified: true,
  onboardingCompleted: true,
  ...overrides,
});

describe('SettingsView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('changes the password', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, me()))
      .mockResolvedValueOnce(
        jsonResponse(200, { user: me(), accessTokenExpiresAt: '2026-10-20T00:15:00.000Z' }),
      );
    renderWithProviders(<SettingsView />);

    await user.type(await screen.findByLabelText(/^Mật khẩu hiện tại/), 'leap2026');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'leap2027');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Đã đổi mật khẩu')).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      currentPassword: 'leap2026',
      newPassword: 'leap2027',
    });
    expect(screen.getByLabelText(/^Mật khẩu hiện tại/)).toHaveValue('');
  });

  it('rejects reusing the current password before calling the API', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, me()));
    renderWithProviders(<SettingsView />);

    await user.type(await screen.findByLabelText(/^Mật khẩu hiện tại/), 'leap2026');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'leap2026');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Mật khẩu mới phải khác mật khẩu hiện tại.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('explains that root changes its password through configuration', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, me({ role: 'ADMIN', adminLevel: 'ROOT' })));
    renderWithProviders(<SettingsView />);
    expect(await screen.findByText(/chỉ thay đổi được qua cấu hình máy chủ/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Mật khẩu hiện tại/)).not.toBeInTheDocument();
    expect(screen.getByText('Quản trị gốc')).toBeInTheDocument();
  });
});
