import type { AuthUser } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { SettingsView } from './SettingsView';

const fetchMock = vi.fn<typeof fetch>();
const redirect = vi.fn();
vi.mock('@/lib/auth-redirect', () => ({ useAuthRedirect: () => redirect }));

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
    redirect.mockReset();
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
    expect(screen.queryByRole('button', { name: 'Xoá tài khoản' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải dữ liệu (JSON)' })).toBeInTheDocument();
  });

  it('deletes the account after the password is confirmed, then goes to the login page', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, me()))
      .mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS', message: 'x' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderWithProviders(<SettingsView />);

    await user.click(await screen.findByRole('button', { name: 'Xoá tài khoản' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xoá tài khoản vĩnh viễn?' });
    const password = within(dialog).getByLabelText(/^Mật khẩu hiện tại/);
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }));
    expect(await within(dialog).findByText('Vui lòng nhập thông tin này.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(password, 'wrong-pass');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }));
    expect(await within(dialog).findByText('Mật khẩu không đúng.')).toBeInTheDocument();
    // A wrong password is not retried through a session refresh.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.clear(password);
    await user.type(password, 'leap2026');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }));
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith('/login?deleted=1'));
    const [url, init] = fetchMock.mock.calls[2]!;
    expect(String(url)).toMatch(/\/account$/);
    expect(init).toMatchObject({ method: 'DELETE', body: JSON.stringify({ password: 'leap2026' }) });
  });

  it('downloads the data as a JSON file', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, me()))
      .mockResolvedValueOnce(jsonResponse(200, { version: 1, exportedAt: '2026-10-21T08:00:00.000Z' }));
    renderWithProviders(<SettingsView />);

    await user.click(await screen.findByRole('button', { name: 'Tải dữ liệu (JSON)' }));
    expect(await screen.findByText('Đã tải dữ liệu')).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click.mock.contexts[0]).toHaveProperty('download', 'offerleap-export-2026-10-21.json');
    click.mockRestore();
  });
});
