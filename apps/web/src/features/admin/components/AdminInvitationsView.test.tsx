import type { AdminInvitation } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AdminInvitationsView } from './AdminInvitationsView';

const fetchMock = vi.fn<typeof fetch>();

const invitation = (overrides: Partial<AdminInvitation> = {}): AdminInvitation => ({
  id: 'inv1',
  email: 'lan@example.com',
  status: 'PENDING',
  invitedBy: 'Root Admin',
  createdAt: '2026-10-20T00:00:00.000Z',
  expiresAt: '2026-10-22T00:00:00.000Z',
  acceptedAt: null,
  ...overrides,
});

describe('AdminInvitationsView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('invites an admin by email in the chosen language', async () => {
    const user = userEvent.setup();
    let body: unknown;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body));
        return jsonResponse(201, invitation({ email: 'new@example.com' }));
      }
      return jsonResponse(200, []);
    });
    renderWithProviders(<AdminInvitationsView />);

    expect(await screen.findByText('Chưa gửi lời mời nào.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Email người được mời/), 'new@example.com');
    await user.selectOptions(screen.getByLabelText('Ngôn ngữ email'), 'en');
    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));

    expect(await screen.findByText('Đã gửi lời mời tới new@example.com')).toBeInTheDocument();
    expect(body).toEqual({ email: 'new@example.com', locale: 'en' });
  });

  it('shows statuses and offers resend/revoke only while the invitation is open', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, [
        invitation(),
        invitation({ id: 'inv2', email: 'done@example.com', status: 'ACCEPTED' }),
      ]),
    );
    renderWithProviders(<AdminInvitationsView />);

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('Đang chờ')).toBeInTheDocument();
    expect(within(items[0]!).getByRole('button', { name: 'Gửi lại' })).toBeInTheDocument();
    expect(within(items[1]!).getByText('Đã chấp nhận')).toBeInTheDocument();
    expect(within(items[1]!).queryByRole('button')).not.toBeInTheDocument();
  });
});
