import type { ResumeMimeType } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { ResumePreviewDialog } from './ResumePreviewDialog';

const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn(() => 'blob:cv');
const revokeObjectURL = vi.fn();
const DOCX: ResumeMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const resume = (fileName: string, mimeType: ResumeMimeType) => ({ id: 'r1', fileName, mimeType });
const fileResponse = (type: string) => new Response(new Blob(['bytes'], { type }), { status: 200 });

describe('ResumePreviewDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  });
  afterEach(() => {
    fetchMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.unstubAllGlobals();
  });

  it('shows a PDF in the browser viewer and releases it when closed', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse('application/pdf'));
    const { rerender } = renderWithProviders(
      <ResumePreviewDialog resume={resume('cv.pdf', 'application/pdf')} onClose={() => {}} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Đang mở CV…');
    const frame = await screen.findByTitle('Nội dung CV cv.pdf');
    expect(frame).toHaveAttribute('src', 'blob:cv');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/resumes\/r1\/file$/);

    // When the file is released, nothing on the page may point at it any more (an <img> would reload it and fail).
    const stillUsed: (Element | null)[] = [];
    revokeObjectURL.mockImplementation(() => stillUsed.push(document.querySelector('[src="blob:cv"]')));
    rerender(<ResumePreviewDialog resume={null} onClose={() => {}} />);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cv');
    expect(stillUsed).toEqual([null]);
  });

  it('shows a photo as an image', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse('image/jpeg'));
    renderWithProviders(<ResumePreviewDialog resume={resume('cv.jpg', 'image/jpeg')} onClose={() => {}} />);

    expect(await screen.findByRole('img', { name: 'Ảnh CV cv.jpg' })).toHaveAttribute('src', 'blob:cv');
  });

  it('shows a DOCX as HTML in a sandboxed frame that can load nothing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { html: '<p>Nguyễn Văn An</p>' }));
    renderWithProviders(<ResumePreviewDialog resume={resume('cv.docx', DOCX)} onClose={() => {}} />);

    const frame = await screen.findByTitle('Nội dung CV cv.docx');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain('<body><p>Nguyễn Văn An</p></body>');
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/resumes\/r1\/preview$/);
  });

  it('downloads the original file under its uploaded name', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { html: '<p>CV</p>' }))
      .mockResolvedValueOnce(fileResponse(DOCX));
    renderWithProviders(<ResumePreviewDialog resume={resume('CV Minh.docx', DOCX)} onClose={() => {}} />);

    await screen.findByTitle('Nội dung CV CV Minh.docx');
    await user.click(screen.getByRole('button', { name: 'Tải xuống' }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(click.mock.contexts[0]).toHaveProperty('download', 'CV Minh.docx');
    expect(String(fetchMock.mock.calls[1]![0])).toMatch(/\/resumes\/r1\/file$/);
    click.mockRestore();
  });

  it('explains when the file cannot be opened', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { code: 'COMMON_NOT_FOUND', message: 'Resume not found' }),
    );
    renderWithProviders(
      <ResumePreviewDialog resume={resume('cv.pdf', 'application/pdf')} onClose={() => {}} />,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTitle('Nội dung CV cv.pdf')).not.toBeInTheDocument();
  });
});
