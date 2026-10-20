import type { AnalysisDetail } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { AnalysisView } from './AnalysisView';

const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));

const fetchMock = vi.fn<typeof fetch>();

const analysis = (overrides: Partial<AnalysisDetail> = {}): AnalysisDetail => ({
  id: 'a1',
  status: 'COMPLETED',
  jobTitle: 'Senior Frontend Engineer',
  company: 'Acme Tech',
  score: 72,
  resumeFileName: 'cv.pdf',
  createdAt: '2026-10-20T03:00:00.000Z',
  resumeId: 'r1',
  jobDescription: 'Acme Tech is hiring…',
  locale: 'vi',
  errorCode: null,
  result: {
    score: 72,
    summary: 'Khá phù hợp với vị trí.',
    matchedSkills: ['React', 'TypeScript'],
    missingSkills: [
      { name: 'GraphQL', importance: 'REQUIRED' },
      { name: 'Playwright', importance: 'NICE_TO_HAVE' },
    ],
    strengths: ['6 năm React'],
    gaps: [],
    suggestions: ['Thêm dự án GraphQL'],
  },
  ...overrides,
});

describe('AnalysisView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the score, skills and suggestions', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, analysis()));
    renderWithProviders(<AnalysisView id="a1" />);

    const meter = await screen.findByRole('meter', { name: 'Mức độ phù hợp' });
    expect(meter).toHaveAttribute('aria-valuetext', '72 trên 100, Khá phù hợp');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Senior Frontend Engineer · Acme Tech',
    );
    expect(screen.getByText('GraphQL · Bắt buộc')).toBeInTheDocument();
    expect(screen.getByText('Playwright · Ưu tiên')).toBeInTheDocument();
    expect(screen.getByText('Thêm dự án GraphQL')).toBeInTheDocument();
    // Empty sections say so instead of disappearing.
    expect(screen.getByText('Không có mục nào.')).toBeInTheDocument();
    // No documents were used: no sources section.
    expect(screen.queryByText('Tài liệu đã dùng')).not.toBeInTheDocument();
  });

  it('lists the passages from personal documents the AI relied on', async () => {
    const base = analysis();
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ...base,
        result: {
          ...base.result,
          sources: [{ documentId: 'd1', title: 'Dự án GraphQL', excerpt: 'API GraphQL với Apollo…' }],
        },
      }),
    );
    renderWithProviders(<AnalysisView id="a1" />);

    expect(await screen.findByRole('heading', { name: 'Tài liệu đã dùng' })).toBeInTheDocument();
    expect(screen.getByText('Dự án GraphQL')).toBeInTheDocument();
    expect(screen.getByText('API GraphQL với Apollo…')).toBeInTheDocument();
  });

  it('polls while the AI is working', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, analysis({ status: 'PROCESSING', result: null, jobTitle: null })),
      )
      .mockResolvedValue(jsonResponse(200, analysis()));
    renderWithProviders(<AnalysisView id="a1" />);

    expect(await screen.findByText('AI đang phân tích…')).toBeInTheDocument();
    expect(await screen.findByRole('meter', {}, { timeout: 5_000 })).toBeInTheDocument();
  });

  it('retries a failed analysis with the same CV and job description', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, init) =>
      init?.method === 'POST'
        ? jsonResponse(202, analysis({ id: 'a2', status: 'PENDING', result: null }))
        : jsonResponse(200, analysis({ status: 'FAILED', result: null, errorCode: 'AI_UNAVAILABLE' })),
    );
    renderWithProviders(<AnalysisView id="a1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không phân tích được.*Dịch vụ AI đang quá tải/,
    );
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/analyses/a2'));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      resumeId: 'r1',
      jobDescription: 'Acme Tech is hiring…',
      locale: 'vi',
    });
  });

  it('deletes after confirmation', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(200, analysis()),
    );
    renderWithProviders(<AnalysisView id="a1" />);

    await user.click(await screen.findByRole('button', { name: 'Xoá' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xoá phân tích này?' });
    await user.click(within(dialog).getByRole('button', { name: 'Xoá' }));

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/analyses'));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });
});
