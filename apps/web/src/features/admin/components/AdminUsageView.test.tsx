import type { AiUsageStats } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AdminUsageView } from './AdminUsageView';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const stats: AiUsageStats = {
  days: 7,
  totals: { calls: 40, failures: 2, inputTokens: 30_000, outputTokens: 5_000, avgLatencyMs: 3400 },
  byTask: [
    {
      task: 'job-match.v1',
      calls: 30,
      failures: 1,
      inputTokens: 25_000,
      outputTokens: 4_000,
      avgLatencyMs: 4100,
    },
    {
      task: 'experimental.v9',
      calls: 10,
      failures: 1,
      inputTokens: 5_000,
      outputTokens: 1_000,
      avgLatencyMs: 1200,
    },
  ],
  byDay: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-10-${String(14 + index).padStart(2, '0')}`,
    calls: index === 6 ? 16 : 4,
    failures: 0,
  })),
  topUsers: [{ userId: 'u1', email: 'minh@example.com', fullName: 'Trần Minh', calls: 25, tokens: 20_000 }],
  defaultQuota: 50,
};

describe('AdminUsageView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows totals, the daily chart, usage per feature and the heaviest users', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, stats));
    renderWithProviders(<AdminUsageView />);

    const calls = (await screen.findByText('Lượt gọi AI')).closest('div')!;
    expect(within(calls).getByText('40')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('3,4 giây')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Lượt gọi AI theo ngày\. 40 lượt trong 7 ngày, cao nhất 16 lượt vào 20\/10/,
      }),
    ).toBeInTheDocument();
    // Known prompts get a feature name; unknown ones stay as they are.
    expect(screen.getByRole('rowheader', { name: 'Phân tích CV–JD (v1)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'experimental.v9' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trần Minh' })).toHaveAttribute('href', '/admin/users/u1');
  });

  it('reloads for another period', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, stats));
    renderWithProviders(<AdminUsageView />);

    await screen.findByText('Lượt gọi AI');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/days=30$/);
    await user.selectOptions(screen.getByLabelText('Khoảng thời gian'), '7');
    await vi.waitFor(() => expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/days=7$/));
  });
});
