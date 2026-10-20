import type { ResumeSummary } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { NewAnalysisForm } from './NewAnalysisForm';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();
const JD =
  'Acme Tech is hiring a Senior Frontend Engineer with React, TypeScript and GraphQL experience. '.repeat(2);

const resume = (id: string, fileName: string): ResumeSummary => ({
  id,
  fileName,
  status: 'COMPLETED',
  suggestions: null,
  errorCode: null,
  createdAt: '2026-10-19T08:00:00.000Z',
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

describe('NewAnalysisForm', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    vi.unstubAllGlobals();
  });

  it('preselects the newest CV, sends the UI locale and opens the analysis', async () => {
    const user = userEvent.setup();
    let body: unknown;
    routes({
      'GET /resumes': () => jsonResponse(200, [resume('r2', 'cv-new.pdf'), resume('r1', 'cv-old.pdf')]),
      'POST /analyses': (init) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse(202, { id: 'a1', status: 'PENDING' });
      },
    });
    renderWithProviders(<NewAnalysisForm />, { locale: 'en' });

    const select = await screen.findByLabelText(/^CV to analyse/);
    await vi.waitFor(() => expect(select).toHaveValue('r2'));
    await user.click(screen.getByLabelText(/^Job description/));
    await user.paste(JD);
    await user.click(screen.getByRole('button', { name: 'Analyse' }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/analyses/a1'));
    expect(body).toEqual({ resumeId: 'r2', jobDescription: JD.trim(), locale: 'en' });
  });

  it('checks the job description length before calling the API', async () => {
    const user = userEvent.setup();
    routes({ 'GET /resumes': () => jsonResponse(200, [resume('r1', 'cv.pdf')]) });
    renderWithProviders(<NewAnalysisForm />);

    await user.type(await screen.findByLabelText(/^Mô tả công việc/), 'React dev');
    expect(screen.getByText('9/20000 ký tự · tối thiểu 100')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Phân tích' }));

    expect(await screen.findByText('Cần ít nhất 100 ký tự.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('offers an upload when the user has no CV, then selects the uploaded one', async () => {
    const user = userEvent.setup();
    routes({
      'GET /resumes': () => jsonResponse(200, []),
      'POST /resumes': () => jsonResponse(202, { ...resume('r9', 'cv.pdf'), status: 'PENDING' }),
    });
    renderWithProviders(<NewAnalysisForm />);

    expect(await screen.findByText('Bạn chưa có CV nào. Tải CV lên để bắt đầu.')).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText(/Kéo thả CV/),
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByLabelText(/^CV dùng để phân tích/)).toHaveValue('r9');
  });
});
