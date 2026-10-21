import type { InterviewListItem } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { InterviewHistory } from './InterviewHistory';

const fetchMock = vi.fn<typeof fetch>();
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('page=2') }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
  usePathname: () => '/interviews',
  useRouter: () => ({ replace: vi.fn() }),
}));

const interview = (id: string): InterviewListItem => ({
  id,
  jobTitle: `Frontend ${id}`,
  type: 'MIXED',
  status: 'COMPLETED',
  questionCount: 3,
  answeredCount: 3,
  overallScore: 68,
  createdAt: '2026-10-21T00:00:00.000Z',
});

describe('InterviewHistory', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('requests the page from the URL and offers paging', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { items: [interview('b')], total: 11, page: 2, pageSize: 10 }),
    );
    renderWithProviders(<InterviewHistory />);

    expect(await screen.findByRole('link', { name: /Frontend b/ })).toHaveAttribute('href', '/interviews/b');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/interviews\?page=2&pageSize=10$/);
    expect(screen.getByRole('navigation', { name: 'Các trang lịch sử phỏng vấn' })).toBeInTheDocument();
    expect(screen.getByText('Trang 2/2')).toBeInTheDocument();
  });
});
