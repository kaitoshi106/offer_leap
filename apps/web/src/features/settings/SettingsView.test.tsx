import type { AuthUser, SignInMethods } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NETWORK_ERROR } from '@/lib/api/errors';
import { jsonResponse, renderWithProviders } from '@/test/render';

import { SettingsView } from './SettingsView';

const fetchMock = vi.fn<typeof fetch>();
const redirect = vi.fn();
vi.mock('@/lib/auth-redirect', () => ({ useAuthRedirect: () => redirect }));
let searchParams = new URLSearchParams();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
vi.mock('@/i18n/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ replace }) }));

// Google is mocked at the hook level so the fetch queue below only holds the requests each test is about.
let providers = { google: false };
let methods: SignInMethods | undefined = { hasPassword: true, identities: [] };
let methodsError: unknown = null;
const startGoogleAccountFlow = vi.fn(async () => {});
const unlinkGoogle = vi.fn();
vi.mock('@/features/auth/api/google', () => ({
  useAuthProviders: () => ({ data: providers }),
  useSignInMethods: () => ({ data: methods, error: methodsError }),
  useUnlinkGoogle: () => ({ mutate: unlinkGoogle, isPending: false }),
  startGoogleAccountFlow: (...args: unknown[]) => startGoogleAccountFlow(...(args as [])),
}));

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
    replace.mockReset();
    startGoogleAccountFlow.mockClear();
    searchParams = new URLSearchParams();
    providers = { google: false };
    methods = { hasPassword: true, identities: [] };
    methodsError = null;
    vi.unstubAllGlobals();
  });

  it("doesn't guess the password sections when the sign-in methods failed to load", async () => {
    methods = undefined;
    methodsError = new ApiError(0, NETWORK_ERROR);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, me()));
    renderWithProviders(<SettingsView />);

    // A Google-only account would otherwise be shown a "current password" field it can't fill.
    await screen.findByRole('heading', { name: 'Cài đặt tài khoản' });
    expect(screen.queryByLabelText(/^Mật khẩu hiện tại/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toHaveLength(2);
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

  describe('with Google', () => {
    beforeEach(() => {
      providers = { google: true };
    });

    it('links Google, and reports the result of the flow from the URL', async () => {
      const user = userEvent.setup();
      searchParams = new URLSearchParams('linked=google');
      fetchMock.mockResolvedValueOnce(jsonResponse(200, me()));
      renderWithProviders(<SettingsView />);

      expect(await screen.findByText('Đã liên kết Google')).toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith('/settings');
      await user.click(await screen.findByRole('button', { name: 'Liên kết Google' }));
      expect(startGoogleAccountFlow).toHaveBeenCalledWith('link', 'vi');
    });

    it('shows a failed flow', async () => {
      searchParams = new URLSearchParams('error=AUTH_OAUTH_ALREADY_LINKED');
      fetchMock.mockResolvedValueOnce(jsonResponse(200, me()));
      renderWithProviders(<SettingsView />);
      expect(await screen.findByText(/đã được liên kết với một tài khoản khác/)).toBeInTheDocument();
    });

    it('gives a Google-only account a way to set a password and confirms deletion with Google', async () => {
      const user = userEvent.setup();
      methods = {
        hasPassword: false,
        identities: [{ provider: 'GOOGLE', email: 'minh@gmail.com', createdAt: '2026-10-21T00:00:00.000Z' }],
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, me()))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      renderWithProviders(<SettingsView />);

      expect(await screen.findByText('Đã liên kết với minh@gmail.com')).toBeInTheDocument();
      // Unlinking would lock the user out.
      expect(screen.queryByRole('button', { name: 'Gỡ liên kết' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Mật khẩu hiện tại/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Gửi email đặt mật khẩu' }));
      expect(await screen.findByText('Đã gửi email tới minh@example.com')).toBeInTheDocument();
      expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({ email: 'minh@example.com' });

      await user.click(screen.getByRole('button', { name: 'Xoá tài khoản' }));
      const dialog = await screen.findByRole('dialog', { name: 'Xoá tài khoản vĩnh viễn?' });
      expect(within(dialog).queryByLabelText(/^Mật khẩu hiện tại/)).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Xác nhận bằng Google' }));
      expect(startGoogleAccountFlow).toHaveBeenCalledWith('delete', 'vi');
    });

    it('unlinks when a password is set', async () => {
      const user = userEvent.setup();
      methods = {
        hasPassword: true,
        identities: [{ provider: 'GOOGLE', email: 'minh@gmail.com', createdAt: '2026-10-21T00:00:00.000Z' }],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, me()));
      renderWithProviders(<SettingsView />);
      await user.click(await screen.findByRole('button', { name: 'Gỡ liên kết' }));
      expect(unlinkGoogle).toHaveBeenCalledOnce();
    });

    it('is not offered to admins', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, me({ role: 'ADMIN', adminLevel: 'GENERAL' })));
      renderWithProviders(<SettingsView />);
      expect(await screen.findByText('Quản trị viên')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Đăng nhập bằng Google' })).not.toBeInTheDocument();
    });
  });
});
