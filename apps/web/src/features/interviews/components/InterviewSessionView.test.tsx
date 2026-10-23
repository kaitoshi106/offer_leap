import type { InterviewDetail, InterviewQuestion } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { InterviewSessionView } from './InterviewSessionView';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const question = (index: number, overrides: Partial<InterviewQuestion> = {}): InterviewQuestion => ({
  index,
  question: `Question ${index + 1}?`,
  focus: `Focus ${index + 1}`,
  answer: null,
  skipped: false,
  score: null,
  feedback: null,
  betterAnswer: null,
  ...overrides,
});

const interview = (
  questions: InterviewQuestion[],
  overrides: Partial<InterviewDetail> = {},
): InterviewDetail => ({
  id: 'i1',
  jobTitle: 'Frontend Engineer',
  type: 'MIXED',
  status: 'IN_PROGRESS',
  questionCount: questions.length,
  answeredCount: questions.filter((q) => q.answer !== null || q.skipped).length,
  overallScore: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  applicationId: null,
  jobDescription: null,
  locale: 'en',
  questions,
  result: null,
  ...overrides,
});

const answered = (index: number) =>
  question(index, {
    answer: 'I measured first.',
    score: 7,
    feedback: 'Good start; add numbers.',
    betterAnswer: 'I profiled the app and cut render time by half.',
  });

describe('InterviewSessionView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows answered questions with feedback and only the current open question', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, interview([answered(0), question(1), question(2)])));
    renderWithProviders(<InterviewSessionView id="i1" />, { locale: 'en' });

    expect(await screen.findByText('Question 1?')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('Good start; add numbers.')).toBeInTheDocument();
    expect(screen.getByText('Question 2?')).toBeInTheDocument();
    // Later questions stay hidden until their turn.
    expect(screen.queryByText('Question 3?')).not.toBeInTheDocument();
    expect(screen.getByText('1/3 answered')).toBeInTheDocument();
  });

  it('sends an answer, shows the feedback and moves focus to the next question', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, interview([question(0), question(1)])))
      .mockResolvedValueOnce(jsonResponse(200, interview([answered(0), question(1)])));
    renderWithProviders(<InterviewSessionView id="i1" />, { locale: 'en' });

    await user.type(await screen.findByLabelText('Your answer'), 'I measured first.');
    await user.click(screen.getByRole('button', { name: 'Send answer' }));

    expect(await screen.findByText('Good start; add numbers.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question 2/2' })).toHaveFocus();
    expect(screen.getByLabelText('Your answer')).toHaveValue('');
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toMatch(/\/interviews\/i1\/questions\/0\/answer$/);
    expect(JSON.parse(String(init?.body))).toEqual({ answer: 'I measured first.' });
  });

  it('skips, then finishes with a summary', async () => {
    const user = userEvent.setup();
    const done = interview([answered(0), question(1, { skipped: true, score: 0 })]);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, interview([answered(0), question(1)])))
      .mockResolvedValueOnce(jsonResponse(200, done))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...done,
          status: 'COMPLETED',
          overallScore: 68,
          result: { overallScore: 68, summary: 'Solid.', strengths: ['Clear'], improvements: ['Numbers'] },
        }),
      );
    renderWithProviders(<InterviewSessionView id="i1" />, { locale: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('You skipped this question.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See summary' }));

    expect(await screen.findByRole('meter', { name: 'Readiness' })).toHaveAttribute('aria-valuenow', '68');
    expect(screen.getByText('Solid.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
  });

  it('keeps the answer when the AI is busy so it can be sent again', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, interview([question(0)])))
      .mockResolvedValueOnce(jsonResponse(503, { statusCode: 503, code: 'AI_UNAVAILABLE', message: 'busy' }));
    renderWithProviders(<InterviewSessionView id="i1" />);

    await user.type(await screen.findByLabelText('Câu trả lời của bạn'), 'Câu trả lời');
    await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ AI đang quá tải');
    expect(screen.getByLabelText('Câu trả lời của bạn')).toHaveValue('Câu trả lời');
  });

  it('waits for the recording to stop before sending, so the last spoken phrase is not lost', async () => {
    const user = userEvent.setup();
    // A fake recogniser: the final phrase only arrives when recording stops, like the browser's.
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() {}
      stop() {
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: 'and it shipped on time' } }],
        });
        this.onend?.();
      }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    fetchMock.mockResolvedValue(jsonResponse(200, interview([question(0)])));
    renderWithProviders(<InterviewSessionView id="i1" />, { locale: 'en' });

    await user.type(await screen.findByRole('textbox'), 'I led the migration');
    await user.click(screen.getByRole('button', { name: 'Answer by voice' }));
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(screen.getByRole('textbox')).toHaveValue('I led the migration and it shipped on time');
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeEnabled();
  });
});
