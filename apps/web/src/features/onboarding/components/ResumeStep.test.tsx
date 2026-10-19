import type { OnboardingState, ResumeSummary } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { useOnboardingState } from '../api/use-onboarding';
import { ResumeStep } from './ResumeStep';

const fetchMock = vi.fn<typeof fetch>();
const onSaved = vi.fn();

const resume = (overrides: Partial<ResumeSummary> = {}): ResumeSummary => ({
  id: 'r1',
  fileName: 'cv.pdf',
  status: 'PENDING',
  suggestions: null,
  errorCode: null,
  createdAt: '2026-10-19T00:00:00.000Z',
  ...overrides,
});

const state = (latest: ResumeSummary | null) =>
  ({ step: 'resume', completed: false, values: {}, resume: latest }) as unknown as OnboardingState;

/** Renders the step from the cached onboarding state, like the wizard does. */
function Harness() {
  const { data } = useOnboardingState();
  return data ? <ResumeStep resume={data.resume} suggestedCount={3} onSaved={onSaved} /> : null;
}

/** Answers API calls by method + path. */
function routes(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname.replace('/api/v1', '')}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler();
  });
}

const pdf = () => new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' });

describe('ResumeStep', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    onSaved.mockReset();
    vi.unstubAllGlobals();
  });

  it('uploads the CV, shows progress while the AI reads it, then reloads the filled-in draft', async () => {
    const user = userEvent.setup();
    let polls = 0;
    let latest: ResumeSummary | null = null;
    routes({
      'GET /onboarding': () => jsonResponse(200, state(latest)),
      'POST /resumes': () => jsonResponse(202, (latest = resume())),
      'GET /resumes/r1': () =>
        jsonResponse(200, (latest = resume({ status: (polls += 1) > 1 ? 'COMPLETED' : 'PROCESSING' }))),
      'PUT /onboarding/draft': () => jsonResponse(200, state(resume({ status: 'COMPLETED' }))),
    });
    renderWithProviders(<Harness />);

    await user.upload(await screen.findByLabelText(/Kéo thả CV/), pdf());
    expect(await screen.findByText('AI đang đọc CV…')).toBeInTheDocument();

    expect(await screen.findByText('Đã đọc xong cv.pdf', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByText(/Đã điền 3 mục từ CV/)).toBeInTheDocument();
    // The API wrote the CV values into the draft, so the draft is fetched again.
    const draftLoads = fetchMock.mock.calls.filter(
      ([url, options]) => String(url).endsWith('/onboarding') && (options?.method ?? 'GET') === 'GET',
    );
    expect(draftLoads.length).toBeGreaterThanOrEqual(2);
    const [, init] = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')!;
    expect(init?.body).toBeInstanceOf(FormData);

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('rejects unsupported files before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    routes({ 'GET /onboarding': () => jsonResponse(200, state(null)) });
    renderWithProviders(<Harness />);

    await user.upload(
      await screen.findByLabelText(/Kéo thả CV/),
      new File(['hi'], 'cv.txt', { type: 'text/plain' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Chỉ hỗ trợ file PDF, DOCX, PNG, JPG hoặc WEBP.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('explains a failed parse and still lets the user skip', async () => {
    const user = userEvent.setup();
    routes({
      'GET /onboarding': () =>
        jsonResponse(200, state(resume({ status: 'FAILED', errorCode: 'AI_UNAVAILABLE' }))),
      'PUT /onboarding/draft': () => jsonResponse(200, state(null)),
    });
    renderWithProviders(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không đọc được cv.pdf.*Dịch vụ AI đang quá tải/,
    );
    expect(screen.getByLabelText(/Kéo thả CV/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bỏ qua, tự nhập' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
