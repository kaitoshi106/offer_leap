import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { NewInterviewForm } from './NewInterviewForm';

const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

const fetchMock = vi.fn<typeof fetch>();
const applications = [
  {
    id: 'app1',
    company: 'Acme',
    jobTitle: 'React Engineer',
    status: 'APPLIED',
    position: 0,
    score: null,
    hasCoverLetter: false,
    updatedAt: '2026-10-20T00:00:00.000Z',
  },
];

function routes(onCreate: (body: unknown) => void) {
  fetchMock.mockImplementation(async (_input, init) => {
    if (init?.method === 'POST') {
      onCreate(JSON.parse(String(init.body)));
      return jsonResponse(201, { id: 'i1' });
    }
    return jsonResponse(200, applications);
  });
}

describe('NewInterviewForm', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it('starts an interview for a typed job title', async () => {
    const user = userEvent.setup();
    let body: unknown;
    routes((value) => (body = value));
    renderWithProviders(<NewInterviewForm />, { locale: 'en' });

    await user.type(screen.getByLabelText(/^Job title/), 'Data Engineer');
    await user.click(screen.getByLabelText(/^Technical/));
    await user.selectOptions(screen.getByLabelText('Number of questions'), '7');
    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/interviews/i1'));
    expect(body).toEqual({
      jobTitle: 'Data Engineer',
      // Empty optional text is sent as null (shared schema transform).
      jobDescription: null,
      type: 'TECHNICAL',
      questionCount: 7,
      locale: 'en',
    });
  });

  it('preselects the application from the URL and uses its title and saved description', async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams('applicationId=app1');
    let body: unknown;
    routes((value) => (body = value));
    renderWithProviders(<NewInterviewForm />);

    // Filled in once the saved applications have loaded.
    await vi.waitFor(() => expect(screen.getByLabelText(/^Vị trí ứng tuyển/)).toHaveValue('React Engineer'));
    expect(screen.getByText('Dùng mô tả công việc đã lưu của vị trí này.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bắt đầu phỏng vấn' }));

    await vi.waitFor(() =>
      expect(body).toMatchObject({ applicationId: 'app1', jobTitle: 'React Engineer', jobDescription: null }),
    );
  });
});
