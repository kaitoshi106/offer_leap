'use client';

import type { ResumeSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button, Spinner, Text } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { Dialog } from '@/components/organisms';
import { useErrorText } from '@/lib/api/use-error-text';

import { resumesApi } from '../api/resumes-api';
import { useResumeFile } from '../api/use-resumes';

/** Same height for every kind of file, so the dialog doesn't jump when the content arrives. */
const FRAME_CLASSES = 'h-[min(70vh,48rem)] w-full rounded-md border border-border';

/**
 * @description The HTML page a DOCX is shown in. It comes from the user's file, so the frame is sandboxed (no
 * scripts, its own origin) and the CSP lets it load nothing but its embedded images. System colours, not tokens:
 * this is the document's paper, always light, like a PDF page.
 * @param html - Body converted from the DOCX by the API.
 */
const docxPage = (html: string) =>
  '<!doctype html><html><head><meta charset="utf-8">' +
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">` +
  '<style>:root{color-scheme:light}body{margin:0;padding:24px;background:Canvas;color:CanvasText;' +
  'font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}' +
  'table{border-collapse:collapse}td,th{border:1px solid GrayText;padding:4px 8px}</style></head>' +
  `<body>${html}</body></html>`;

/**
 * @description A page-local URL for a downloaded file, released when the file changes or the dialog closes.
 * @param blob - The file, once loaded.
 */
function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    // Created here, not during render, so it can be revoked: in StrictMode a memoised URL would be revoked by the
    // simulated unmount and then reused.
    const next = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}

/** Saves a file through a temporary link, with the name the user uploaded it under. */
function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ResumePreviewDialogProps {
  /** The CV to show; null keeps the dialog closed. */
  resume: Pick<ResumeSummary, 'id' | 'fileName' | 'mimeType'> | null;
  onClose: () => void;
}

/**
 * @description Shows an uploaded CV as it was stored: images and PDFs as they are (the browser's own viewer),
 * DOCX as HTML converted by the API. The original can be downloaded, which also covers phones that show only the
 * first page of a PDF in a frame.
 * @param props - {@link ResumePreviewDialogProps}
 */
export function ResumePreviewDialog({ resume, onClose }: ResumePreviewDialogProps) {
  const t = useTranslations('resumePreview');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const content = useResumeFile(resume);
  const url = useObjectUrl(content.data?.kind === 'file' ? content.data.blob : undefined);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);

  async function download() {
    if (!resume) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      const blob = content.data?.kind === 'file' ? content.data.blob : await resumesApi.file(resume.id);
      saveFile(blob, resume.fileName);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setDownloading(false);
    }
  }

  function close() {
    setDownloadError(null);
    onClose();
  }

  const fileName = resume?.fileName ?? '';
  let body;
  if (!resume) {
    // Closing: the file is released next, so nothing may still point at it (an <img> would reload it and fail).
    body = null;
  } else if (content.error) {
    body = <Alert tone="danger">{errorText(content.error)}</Alert>;
  } else if (content.data?.kind === 'html') {
    body = (
      <>
        <Text size="sm" tone="muted">
          {t('docxNote')}
        </Text>
        <iframe
          sandbox=""
          srcDoc={docxPage(content.data.html)}
          title={t('frameTitle', { fileName })}
          className={FRAME_CLASSES}
        />
      </>
    );
  } else if (url && content.data?.kind === 'file' && resume.mimeType === 'application/pdf') {
    body = <iframe src={url} title={t('frameTitle', { fileName })} className={FRAME_CLASSES} />;
  } else if (url && content.data?.kind === 'file') {
    body = (
      // A blob URL from the user's own upload: next/image can't optimise it and has nothing to add.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={t('imageAlt', { fileName })}
        className="max-h-[min(70vh,48rem)] w-full rounded-md border border-border object-contain"
      />
    );
  } else {
    body = (
      <div className={`${FRAME_CLASSES} flex items-center justify-center gap-2 text-sm text-fg-muted`}>
        <Spinner size="sm" label={null} />
        <span role="status">{t('loading')}</span>
      </div>
    );
  }

  return (
    <Dialog
      open={resume !== null}
      onClose={close}
      title={<span className="wrap-anywhere">{fileName}</span>}
      closeLabel={tCommon('close')}
      className="max-w-4xl"
      error={downloadError ? errorText(downloadError) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {tCommon('close')}
          </Button>
          <Button variant="outline" loading={downloading} onClick={() => void download()}>
            {t('download')}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
