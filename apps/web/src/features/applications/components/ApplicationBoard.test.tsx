import type { ApplicationSummary } from '@offerleap/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { ApplicationBoard } from './ApplicationBoard';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const card = (
  id: string,
  status: ApplicationSummary['status'],
  position: number,
  extra = {},
): ApplicationSummary => ({
  id,
  company: 'Acme',
  jobTitle: `Job ${id}`,
  status,
  position,
  score: null,
  hasCoverLetter: false,
  updatedAt: '2026-10-20T00:00:00.000Z',
  ...extra,
});

let cards: ApplicationSummary[];

function setup() {
  fetchMock.mockImplementation(async (_input, init) => {
    if (init?.method === 'PATCH') {
      // Behave like the API: remember the move so the refetch afterwards returns it.
      const id = new URL(String(_input)).pathname.split('/').at(-2);
      const body = JSON.parse(String(init.body));
      cards = cards.map((item) => (item.id === id ? { ...item, ...body } : item));
      return jsonResponse(
        200,
        cards.find((item) => item.id === id),
      );
    }
    return jsonResponse(200, cards);
  });
  renderWithProviders(<ApplicationBoard />);
}

const moves = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([url, init]) => [new URL(String(url)).pathname.split('/').at(-2), JSON.parse(String(init?.body))]);

describe('ApplicationBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    cards = [
      card('a', 'SAVED', 0, { score: 72, hasCoverLetter: true }),
      card('b', 'SAVED', 1),
      card('c', 'INTERVIEW', 0),
    ];
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows one column per status with its cards', async () => {
    setup();
    const saved = await screen.findByRole('region', { name: /Đã lưu/ });
    expect(
      within(saved)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Job a', 'Job b']);
    expect(within(saved).getByText('Phù hợp 72%')).toBeInTheDocument();
    expect(within(saved).getByText('Đã có cover letter')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Có offer/ })).getByText('Chưa có')).toBeInTheDocument();
  });

  it('moves a card with the keyboard-friendly select and announces it', async () => {
    const user = userEvent.setup();
    setup();

    await user.selectOptions(await screen.findByLabelText('Chuyển Job b tại Acme sang cột'), 'INTERVIEW');

    // Lands on top of the Interview column before the API answers (optimistic update).
    const interview = screen.getByRole('region', { name: /Phỏng vấn/ });
    await vi.waitFor(() =>
      expect(
        within(interview)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Job b', 'Job c']),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Đã chuyển Job b sang cột Phỏng vấn.');
    await vi.waitFor(() => expect(moves()).toEqual([['b', { status: 'INTERVIEW', position: -1 }]]));
  });

  it('moves a card by drag and drop, above the card it is dropped on', async () => {
    setup();
    const target = (await screen.findByText('Job c')).closest('li')!;
    const dragged = screen.getByText('Job b').closest('li')!;

    fireEvent.dragStart(dragged, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(target, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(target, { dataTransfer: {} });

    await vi.waitFor(() => expect(moves()).toEqual([['b', { status: 'INTERVIEW', position: -1 }]]));
  });

  it('rolls back when the API refuses the move', async () => {
    const user = userEvent.setup();
    setup();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === 'PATCH'
        ? jsonResponse(404, { statusCode: 404, code: 'COMMON_NOT_FOUND', message: 'x' })
        : jsonResponse(200, cards),
    );

    await user.selectOptions(await screen.findByLabelText('Chuyển Job a tại Acme sang cột'), 'OFFER');
    const saved = screen.getByRole('region', { name: /Đã lưu/ });
    await vi.waitFor(() => expect(within(saved).getByText('Job a')).toBeInTheDocument());
  });
});
