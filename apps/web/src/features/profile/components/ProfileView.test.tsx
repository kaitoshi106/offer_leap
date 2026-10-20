import type { ProfileValues, ResumeSummary } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { ProfileView } from './ProfileView';

const fetchMock = vi.fn<typeof fetch>();

const profile: ProfileValues = {
  fullName: 'Minh Trần',
  phone: null,
  provinceCode: 'HN',
  industryCode: 'IT',
  jobTitle: 'Frontend Developer',
  level: 'SENIOR',
  yearsOfExperience: 6,
  skills: ['React'],
  expectedSalaryMin: null,
  expectedSalaryMax: null,
  workTypes: ['REMOTE'],
};

const resume = (overrides: Partial<ResumeSummary> = {}): ResumeSummary => ({
  id: 'r1',
  fileName: 'cv-minh.pdf',
  status: 'COMPLETED',
  suggestions: null,
  errorCode: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  analysisCount: 2,
  ...overrides,
});

/** Answers API calls by method + path. */
function routes(handlers: Record<string, (init?: RequestInit) => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname.replace('/api/v1', '')}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler(init);
  });
}

const baseRoutes = {
  'GET /profile': () => jsonResponse(200, profile),
  'GET /taxonomies/industries': () =>
    jsonResponse(200, [{ code: 'IT', nameVi: 'Công nghệ thông tin', nameEn: 'IT' }]),
  'GET /taxonomies/provinces': () =>
    jsonResponse(200, [{ code: 'HN', nameVi: 'Hà Nội', nameEn: 'Hanoi', type: 'CITY' }]),
};

describe('ProfileView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('saves one section of the profile on its own', async () => {
    const user = userEvent.setup();
    let body: unknown;
    routes({
      ...baseRoutes,
      'GET /resumes': () => jsonResponse(200, []),
      'PUT /profile/sections': (init) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse(200, { ...profile, fullName: 'Minh Trần Văn' });
      },
    });
    renderWithProviders(<ProfileView />);

    const personal = await screen.findByRole('region', { name: 'Thông tin cá nhân' });
    const name = within(personal).getByLabelText(/Họ và tên/);
    expect(name).toHaveValue('Minh Trần');
    await user.clear(name);
    await user.type(name, 'Minh Trần Văn');
    await user.click(within(personal).getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
    expect(body).toMatchObject({ section: 'personal', values: { fullName: 'Minh Trần Văn' } });
    expect(screen.getByText('Chưa có CV nào.')).toBeInTheDocument();
  });

  it('deletes a CV after confirming, warning about its analyses', async () => {
    const user = userEvent.setup();
    const remove = vi.fn(() => new Response(null, { status: 204 }));
    let resumes = [resume()];
    routes({
      ...baseRoutes,
      'GET /resumes': () => jsonResponse(200, resumes),
      'DELETE /resumes/r1': () => {
        resumes = [];
        return remove();
      },
    });
    renderWithProviders(<ProfileView />);

    const cvs = await screen.findByRole('region', { name: 'CV đã tải lên' });
    expect(await within(cvs).findByText('cv-minh.pdf')).toBeInTheDocument();
    expect(within(cvs).getByText(/2 phân tích/)).toBeInTheDocument();
    await user.click(within(cvs).getByRole('button', { name: 'Xoá cv-minh.pdf' }));

    const dialog = await screen.findByRole('dialog', { name: 'Xoá cv-minh.pdf?' });
    expect(dialog).toHaveTextContent('2 phân tích dùng CV này');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá' }));

    expect(await screen.findByText('Đã xoá CV')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledOnce();
    expect(await within(cvs).findByText('Chưa có CV nào.')).toBeInTheDocument();
  });
});
