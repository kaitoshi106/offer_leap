import type { ProfileValues, ResumeSummary } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { ProfileView } from './ProfileView';

/** Stands in for the Web Worker compression: renames photos to `.jpg` like the real one, and counts the calls. */
const { prepareResumeFile } = vi.hoisted(() => ({
  prepareResumeFile: vi.fn(async (file: File) => ({
    file: file.type.startsWith('image/') ? new File([file], file.name.replace(/\.\w+$/, '.jpg')) : file,
  })),
}));
vi.mock('@/features/resumes/compression/compress-image', () => ({ prepareResumeFile }));

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
  mimeType: 'application/pdf',
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

  it('opens a CV to view it, and moves a re-uploaded CV to the top instead of listing it twice', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:cv'), revokeObjectURL: vi.fn() }),
    );
    const older = resume({ id: 'r2', fileName: 'cv-cu.pdf', analysisCount: 1 });
    routes({
      ...baseRoutes,
      'GET /resumes': () => jsonResponse(200, [resume({ id: 'r1', fileName: 'cv-moi.pdf' }), older]),
      'GET /resumes/r1/file': () => new Response(new Blob(['%PDF-'], { type: 'application/pdf' })),
      'POST /resumes': () => jsonResponse(202, { ...older, analysisCount: undefined, reused: true }),
    });
    renderWithProviders(<ProfileView />);

    const cvs = await screen.findByRole('region', { name: 'CV đã tải lên' });
    expect(await within(cvs).findByText('Đã dùng 2/5 CV')).toBeInTheDocument();
    await user.click(within(cvs).getByRole('button', { name: 'Xem cv-moi.pdf' }));
    const dialog = await screen.findByRole('dialog', { name: 'cv-moi.pdf' });
    expect(await within(dialog).findByTitle('Nội dung CV cv-moi.pdf')).toHaveAttribute('src', 'blob:cv');
    await user.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]!);

    await user.upload(
      within(cvs).getByLabelText(/Kéo thả CV/),
      new File(['%PDF-'], 'cv-cu.pdf', { type: 'application/pdf' }),
    );
    expect(
      await screen.findByText('Bạn đã tải CV này rồi, CV được đưa lên đầu danh sách'),
    ).toBeInTheDocument();
    const names = within(cvs)
      .getAllByRole('listitem')
      .map((item) => within(item).getByText(/\.pdf$/).textContent);
    expect(names).toEqual(['cv-cu.pdf', 'cv-moi.pdf']);
    // The list keeps the analysis count the upload answer doesn't carry.
    expect(within(cvs).getByText(/· 1 phân tích/)).toBeInTheDocument();
  });

  describe('at the CV limit', () => {
    const full = [1, 2, 3, 4, 5].map((n) =>
      resume({ id: `r${n}`, fileName: `cv-${n}.pdf`, analysisCount: n === 5 ? 2 : 0 }),
    );
    const photo = () => new File(['png'], 'cv-moi.png', { type: 'image/png' });
    const limitError = () =>
      jsonResponse(409, { statusCode: 409, code: 'RESUME_LIMIT_REACHED', message: 'limit' });

    /** Records each upload's `replaceId` and the name of the file sent. */
    function uploads(answer: (replaceId: string | null) => Response) {
      const sent: { replaceId: string | null; fileName: string }[] = [];
      const handler = (init?: RequestInit) => {
        const body = init?.body as FormData;
        const replaceId = body.get('replaceId') as string | null;
        sent.push({ replaceId, fileName: (body.get('file') as File).name });
        return answer(replaceId);
      };
      return { sent, handler };
    }

    beforeEach(() => {
      prepareResumeFile.mockClear();
    });

    it('asks before shrinking the photo, then replaces the oldest CV and its analyses', async () => {
      const user = userEvent.setup();
      const post = uploads(() =>
        jsonResponse(202, resume({ id: 'r6', fileName: 'cv-moi.jpg', status: 'UPLOADED' })),
      );
      routes({ ...baseRoutes, 'GET /resumes': () => jsonResponse(200, full), 'POST /resumes': post.handler });
      renderWithProviders(<ProfileView />);

      const cvs = await screen.findByRole('region', { name: 'CV đã tải lên' });
      await user.upload(await within(cvs).findByLabelText(/Kéo thả CV/), photo());
      const dialog = await screen.findByRole('dialog', { name: 'Bạn đã có đủ 5 CV' });
      expect(dialog).toHaveTextContent(
        'Để tải lên cv-moi.png, CV cũ nhất là cv-5.pdf (tải lên ngày 20 thg 10, 2026) sẽ bị xoá vĩnh viễn, cùng 2 phân tích dùng CV đó.',
      );
      // Nothing was shrunk or sent while the user decides.
      expect(prepareResumeFile).not.toHaveBeenCalled();
      expect(post.sent).toEqual([]);
      await user.click(within(dialog).getByRole('button', { name: 'Xoá CV cũ và tải lên' }));

      expect(await screen.findByText('Đã tải CV lên')).toBeInTheDocument();
      expect(prepareResumeFile).toHaveBeenCalledOnce();
      expect(post.sent).toEqual([{ replaceId: 'r5', fileName: 'cv-moi.jpg' }]);
      await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bạn đã có đủ 5 CV' })).toBeNull());
      const names = within(cvs)
        .getAllByRole('listitem')
        .map((item) => within(item).getByText(/\.(pdf|jpg)$/).textContent);
      expect(names).toEqual(['cv-moi.jpg', 'cv-1.pdf', 'cv-2.pdf', 'cv-3.pdf', 'cv-4.pdf']);
    });

    it('does no work at all when the user cancels', async () => {
      const user = userEvent.setup();
      const post = uploads(limitError);
      routes({ ...baseRoutes, 'GET /resumes': () => jsonResponse(200, full), 'POST /resumes': post.handler });
      renderWithProviders(<ProfileView />);

      const cvs = await screen.findByRole('region', { name: 'CV đã tải lên' });
      await user.upload(await within(cvs).findByLabelText(/Kéo thả CV/), photo());
      const dialog = await screen.findByRole('dialog', { name: 'Bạn đã có đủ 5 CV' });
      await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));

      await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bạn đã có đủ 5 CV' })).toBeNull());
      expect(prepareResumeFile).not.toHaveBeenCalled();
      expect(post.sent).toEqual([]);
      expect(within(cvs).getAllByRole('listitem')).toHaveLength(5);
    });

    it('shrinks a photo only once when the API reaches the limit first (another tab uploaded meanwhile)', async () => {
      const user = userEvent.setup();
      let list = full.slice(0, 4);
      const post = uploads((replaceId) => {
        if (replaceId)
          return jsonResponse(202, resume({ id: 'r6', fileName: 'cv-moi.jpg', status: 'UPLOADED' }));
        list = full;
        return limitError();
      });
      routes({ ...baseRoutes, 'GET /resumes': () => jsonResponse(200, list), 'POST /resumes': post.handler });
      renderWithProviders(<ProfileView />);

      const cvs = await screen.findByRole('region', { name: 'CV đã tải lên' });
      await user.upload(await within(cvs).findByLabelText(/Kéo thả CV/), photo());
      const dialog = await screen.findByRole('dialog', { name: 'Bạn đã có đủ 5 CV' });
      await user.click(within(dialog).getByRole('button', { name: 'Xoá CV cũ và tải lên' }));

      expect(await screen.findByText('Đã tải CV lên')).toBeInTheDocument();
      expect(prepareResumeFile).toHaveBeenCalledOnce();
      expect(post.sent).toEqual([
        { replaceId: null, fileName: 'cv-moi.jpg' },
        { replaceId: 'r5', fileName: 'cv-moi.jpg' },
      ]);
    });
  });
});
