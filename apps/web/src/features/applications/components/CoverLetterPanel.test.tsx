import type { ApplicationDetail } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { CoverLetterPanel } from './CoverLetterPanel';

const fetchMock = vi.fn<typeof fetch>();

const application = (overrides: Partial<ApplicationDetail> = {}): ApplicationDetail => ({
  id: 'app1',
  company: 'Acme',
  jobTitle: 'Frontend Engineer',
  status: 'SAVED',
  position: 0,
  score: null,
  hasCoverLetter: false,
  updatedAt: '2026-10-20T00:00:00.000Z',
  jobUrl: null,
  jobDescription: 'We need React.',
  notes: null,
  coverLetter: null,
  analysisId: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  ...overrides,
});

/** A text stream whose pieces are released one by one via `next()`. */
function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return {
    response: new Response(body, { status: 200 }),
    push: (text: string) => controller.enqueue(new TextEncoder().encode(text)),
    close: () => controller.close(),
  };
}

describe('CoverLetterPanel', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the letter as it is written, then lets the user edit and save it', async () => {
    const user = userEvent.setup();
    const stream = controllableStream();
    fetchMock.mockResolvedValueOnce(stream.response);
    renderWithProviders(<CoverLetterPanel application={application()} />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: 'Write with AI' }));
    expect(screen.getByRole('status')).toHaveTextContent('AI is writing…');

    stream.push('Dear Hiring Team,\n\n');
    expect(await screen.findByText(/Dear Hiring Team,/)).toBeInTheDocument();
    stream.push('I would love to join Acme.');
    stream.close();

    const editor = await screen.findByRole('textbox', { name: 'Cover letter text' });
    expect(editor).toHaveValue('Dear Hiring Team,\n\nI would love to join Acme.');
    expect(screen.getByRole('status')).toHaveTextContent('Cover letter finished.');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/applications\/app1\/cover-letter$/);
    expect(JSON.parse(String(init?.body))).toEqual({ locale: 'en' });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, application({ coverLetter: 'Edited' })));
    await user.type(editor, ' Thanks!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      coverLetter: 'Dear Hiring Team,\n\nI would love to join Acme. Thanks!',
    });
  });

  it('explains an error that happens before writing starts', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { statusCode: 503, code: 'AI_UNAVAILABLE', message: 'busy' }),
    );
    renderWithProviders(<CoverLetterPanel application={application()} />);

    await user.click(screen.getByRole('button', { name: 'Viết bằng AI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ AI đang quá tải');
  });

  it('asks for a job description first', () => {
    renderWithProviders(<CoverLetterPanel application={application({ jobDescription: null })} />);
    expect(screen.getByText(/Thêm mô tả công việc \(JD\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Viết bằng AI' })).toBeDisabled();
  });
});
