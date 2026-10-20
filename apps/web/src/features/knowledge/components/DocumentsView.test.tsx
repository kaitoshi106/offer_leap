import type { KnowledgeDocument } from '@offerleap/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { DocumentsView } from './DocumentsView';

const fetchMock = vi.fn<typeof fetch>();

const document = (overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument => ({
  id: 'd1',
  title: 'Dự án GraphQL',
  source: 'TEXT',
  fileName: null,
  status: 'COMPLETED',
  errorCode: null,
  chunkCount: 2,
  charCount: 1200,
  createdAt: '2026-10-20T00:00:00.000Z',
  ...overrides,
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

describe('DocumentsView', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('lists documents with their status and passages', async () => {
    routes({
      'GET /knowledge': () =>
        jsonResponse(200, [
          document(),
          document({
            id: 'd2',
            title: 'scan',
            source: 'UPLOAD',
            fileName: 'scan.pdf',
            status: 'FAILED',
            errorCode: 'KNOWLEDGE_PROCESSING_FAILED',
          }),
        ]),
    });
    renderWithProviders(<DocumentsView />);

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('Sẵn sàng')).toBeInTheDocument();
    expect(within(items[0]!).getByText(/Nội dung dán · 2 đoạn · 1\.200 ký tự/)).toBeInTheDocument();
    expect(within(items[1]!).getByText('Lỗi')).toBeInTheDocument();
    expect(within(items[1]!).getByText(/Không đọc được nội dung tài liệu này/)).toBeInTheDocument();
    expect(screen.getByText('2/20 tài liệu')).toBeInTheDocument();
  });

  it('saves pasted text', async () => {
    const user = userEvent.setup();
    let body: unknown;
    routes({
      'GET /knowledge': () => jsonResponse(200, []),
      'POST /knowledge/text': (init) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse(202, document({ status: 'PENDING' }));
      },
    });
    renderWithProviders(<DocumentsView />);

    await user.type(await screen.findByLabelText(/^Tiêu đề/), 'Dự án GraphQL');
    await user.type(
      screen.getByLabelText(/^Nội dung\*?$/),
      'Xây dựng API GraphQL với Apollo Server cho hệ thống thanh toán.',
    );
    await user.click(screen.getByRole('button', { name: 'Lưu tài liệu' }));

    expect(await screen.findByText('Đã thêm tài liệu, đang xử lý…')).toBeInTheDocument();
    expect(body).toEqual({
      title: 'Dự án GraphQL',
      content: 'Xây dựng API GraphQL với Apollo Server cho hệ thống thanh toán.',
    });
  });

  it('shows what a search finds, with similarity', async () => {
    const user = userEvent.setup();
    routes({
      'GET /knowledge': () => jsonResponse(200, [document()]),
      'GET /knowledge/search': () =>
        jsonResponse(200, [
          {
            documentId: 'd1',
            title: 'Dự án GraphQL',
            content: 'API GraphQL với Apollo',
            score: 0.734,
            relevant: true,
          },
          { documentId: 'd2', title: 'Sở thích', content: 'Nấu phở', score: 0.51, relevant: false },
        ]),
    });
    renderWithProviders(<DocumentsView />);

    await user.type(await screen.findByLabelText('Nội dung tìm kiếm'), 'GraphQL');
    await user.click(screen.getByRole('button', { name: 'Tìm' }));

    expect(await screen.findByText('Độ tương đồng 0,73')).toBeInTheDocument();
    // Passages below the threshold are shown but marked: the AI would not get them.
    expect(screen.getAllByText('Dưới ngưỡng, AI không dùng')).toHaveLength(1);
    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/\/knowledge\/search\?q=GraphQL$/);
  });
});
