import type { AnalysisSummary } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AnalysisHistory } from './AnalysisHistory';

const fetchMock = vi.fn<typeof fetch>();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
  usePathname: () => '/analyses',
  useRouter: () => ({ replace }),
}));

const analysis = (id: string): AnalysisSummary => ({
  id,
  status: 'COMPLETED',
  jobTitle: `Job ${id}`,
  company: 'Acme',
  score: 72,
  resumeFileName: 'cv.pdf',
  createdAt: '2026-10-21T00:00:00.000Z',
});
const page = (count: number, total: number, pageNumber = 1, pageSize = 10) => ({
  items: Array.from({ length: count }, (_, index) => analysis(`a${index}`)),
  total,
  page: pageNumber,
  pageSize,
});

describe('AnalysisHistory', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it('pages through the history with the page and size from the URL', async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams('page=2&pageSize=50');
    fetchMock.mockResolvedValue(jsonResponse(200, page(3, 103, 2, 50)));
    renderWithProviders(<AnalysisHistory />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/analyses\?page=2&pageSize=50$/);
    expect(screen.getByRole('navigation', { name: 'Các trang lịch sử phân tích' })).toBeInTheDocument();
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(replace).toHaveBeenLastCalledWith('/analyses?page=3&pageSize=50', { scroll: false });
    // A new size starts again at page 1; the default size stays out of the URL.
    await user.selectOptions(screen.getByLabelText('Số mục mỗi trang'), '10 / trang');
    expect(replace).toHaveBeenLastCalledWith('/analyses', { scroll: false });
  });

  it('shows only the latest few on the dashboard, without a pager', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page(10, 40)));
    renderWithProviders(<AnalysisHistory limit={3} />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/analyses\?page=1&pageSize=10$/);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('says so when there is nothing yet', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page(0, 0)));
    renderWithProviders(<AnalysisHistory />);
    expect(await screen.findByText(/Chưa có/)).toBeInTheDocument();
  });
});
