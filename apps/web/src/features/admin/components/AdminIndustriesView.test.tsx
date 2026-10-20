import type { AdminIndustry } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AdminIndustriesView } from './AdminIndustriesView';

const fetchMock = vi.fn<typeof fetch>();

const industries: AdminIndustry[] = [
  { code: 'software', nameVi: 'Công nghệ thông tin', nameEn: 'IT', sortOrder: 0, profileCount: 3 },
  { code: 'game-dev', nameVi: 'Phát triển game', nameEn: 'Game development', sortOrder: 1, profileCount: 0 },
];

describe('AdminIndustriesView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('lists industries and only allows deleting unused ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, industries));
    renderWithProviders(<AdminIndustriesView />);

    const used = (await screen.findByRole('rowheader', { name: /Công nghệ thông tin/ })).closest('tr')!;
    expect(within(used).getByRole('button', { name: 'Xoá Công nghệ thông tin' })).toBeDisabled();
    const unused = screen.getByRole('rowheader', { name: /Phát triển game/ }).closest('tr')!;
    expect(within(unused).getByRole('button', { name: 'Xoá Phát triển game' })).toBeEnabled();
  });

  it('adds an industry with a normalised code', async () => {
    const user = userEvent.setup();
    let body: unknown;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body));
        return jsonResponse(201, industries[1]);
      }
      return jsonResponse(200, industries);
    });
    renderWithProviders(<AdminIndustriesView />);

    await user.type(await screen.findByLabelText(/^Mã/), 'Game-Dev');
    await user.type(screen.getByLabelText(/^Tên tiếng Việt/), 'Phát triển game');
    await user.type(screen.getByLabelText(/^Tên tiếng Anh/), 'Game development');
    await user.click(screen.getByRole('button', { name: 'Thêm ngành' }));

    expect(await screen.findByText('Đã thêm ngành')).toBeInTheDocument();
    expect(body).toEqual({ code: 'game-dev', nameVi: 'Phát triển game', nameEn: 'Game development' });
  });

  it('renames an industry in a dialog', async () => {
    const user = userEvent.setup();
    let patch: unknown;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'PATCH') {
        patch = JSON.parse(String(init.body));
        return jsonResponse(200, industries[0]);
      }
      return jsonResponse(200, industries);
    });
    renderWithProviders(<AdminIndustriesView />);

    await user.click(await screen.findByRole('button', { name: 'Sửa Công nghệ thông tin' }));
    const dialog = screen.getByRole('dialog', { name: 'Sửa ngành software' });
    const name = within(dialog).getByLabelText(/^Tên tiếng Việt/);
    await user.clear(name);
    await user.type(name, 'CNTT / Phần mềm');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await vi.waitFor(() => expect(patch).toEqual({ nameVi: 'CNTT / Phần mềm', nameEn: 'IT' }));
  });
});
