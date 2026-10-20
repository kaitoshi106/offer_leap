import type { AdminUserListItem } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AdminUsersView } from './AdminUsersView';

const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/users',
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const account = (id: string, overrides: Partial<AdminUserListItem> = {}): AdminUserListItem => ({
  id,
  email: `${id}@example.com`,
  fullName: `User ${id}`,
  role: 'USER',
  adminLevel: null,
  status: 'ACTIVE',
  emailVerified: true,
  onboardingCompleted: true,
  lastLoginAt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  ...overrides,
});

describe('AdminUsersView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it('lists accounts with role, status and profile progress, using the filters from the URL', async () => {
    searchParams = new URLSearchParams('status=DISABLED&page=2');
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [
          account('a', { status: 'DISABLED' }),
          account('b', { role: 'ADMIN', adminLevel: 'ROOT', onboardingCompleted: false }),
        ],
        total: 22,
        page: 2,
        pageSize: 10,
      }),
    );
    renderWithProviders(<AdminUsersView />);

    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]!).getByRole('link', { name: 'User a' })).toHaveAttribute('href', '/admin/users/a');
    expect(within(rows[1]!).getByText('Đã khoá')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Quản trị gốc')).toBeInTheDocument();
    expect(screen.getByText('22 tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /\/admin\/users\?status=DISABLED&page=2&pageSize=10$/,
    );
  });

  it('writes filters, search and paging to the URL (filters restart at page 1)', async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams('page=2');
    fetchMock.mockResolvedValue(
      jsonResponse(200, { items: [account('a')], total: 60, page: 2, pageSize: 10 }),
    );
    renderWithProviders(<AdminUsersView />);

    await user.click(await screen.findByRole('button', { name: 'Trang sau' }));
    expect(replace).toHaveBeenLastCalledWith('/admin/users?page=3');

    await user.selectOptions(screen.getByLabelText('Số mục mỗi trang'), '50 / trang');
    expect(replace).toHaveBeenLastCalledWith('/admin/users?pageSize=50');

    await user.selectOptions(screen.getByLabelText('Vai trò'), 'ADMIN');
    expect(replace).toHaveBeenLastCalledWith('/admin/users?role=ADMIN');

    await user.type(screen.getByLabelText('Tìm theo email hoặc tên'), 'minh');
    await vi.waitFor(() => expect(replace).toHaveBeenLastCalledWith('/admin/users?q=minh'));
  });
});
