import type { AdminUserDetail } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AdminUserView } from './AdminUserView';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const detail = (overrides: Partial<AdminUserDetail> = {}): AdminUserDetail => ({
  id: 'u1',
  email: 'minh@example.com',
  fullName: 'Trần Minh',
  role: 'USER',
  adminLevel: null,
  status: 'ACTIVE',
  emailVerified: true,
  onboardingCompleted: true,
  signInMethods: ['PASSWORD'],
  lastLoginAt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  profile: {
    jobTitle: 'Frontend Developer',
    level: 'SENIOR',
    yearsOfExperience: 6,
    provinceCode: 'ha-noi',
    industryCode: 'software',
  },
  activity: { resumes: 2, analyses: 3, applications: 4, interviews: 1 },
  ai: { callsInWindow: 3, limit: 50, override: null },
  manageable: true,
  ...overrides,
});

describe('AdminUserView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the account, career summary and activity', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, detail()));
    renderWithProviders(<AdminUserView id="u1" />);

    expect(await screen.findByRole('heading', { name: 'Trần Minh' })).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText('6 năm')).toBeInTheDocument();
    const applications = screen.getByText('Ứng tuyển').closest('div')!;
    expect(within(applications).getByText('4')).toBeInTheDocument();
  });

  it('disables the account after confirmation', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, detail()))
      .mockResolvedValueOnce(jsonResponse(200, detail({ status: 'DISABLED' })));
    renderWithProviders(<AdminUserView id="u1" />);

    await user.click(await screen.findByRole('button', { name: 'Khoá tài khoản' }));
    const dialog = screen.getByRole('dialog', { name: 'Khoá tài khoản minh@example.com?' });
    await user.click(within(dialog).getByRole('button', { name: 'Khoá tài khoản' }));

    expect(await screen.findByText('Đã khoá tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở khoá tài khoản' })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toMatch(/\/admin\/users\/u1\/status$/);
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'DISABLED' });
  });

  it('hides the action for accounts the admin may not change', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, detail({ role: 'ADMIN', adminLevel: 'ROOT', manageable: false })),
    );
    renderWithProviders(<AdminUserView id="u1" />);
    expect(await screen.findByText('Bạn không có quyền thay đổi tài khoản này.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khoá/i })).not.toBeInTheDocument();
  });

  it('shows AI usage and sets an own limit', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, detail()))
      .mockResolvedValueOnce(
        jsonResponse(200, detail({ ai: { callsInWindow: 3, limit: 10, override: 10 } })),
      );
    renderWithProviders(<AdminUserView id="u1" />);

    expect(await screen.findByText('3/50 lượt trong 24 giờ qua')).toBeInTheDocument();
    expect(screen.getByText('Đang dùng mặc định')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Giới hạn riêng (lượt / 24 giờ)'), '10');
    await user.click(screen.getByRole('button', { name: 'Lưu giới hạn' }));

    expect(await screen.findByText('3/10 lượt trong 24 giờ qua')).toBeInTheDocument();
    expect(screen.getByText('Giới hạn riêng')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toMatch(/\/admin\/users\/u1\/ai-quota$/);
    expect(JSON.parse(String(init?.body))).toEqual({ aiDailyQuota: 10 });
  });
});
