import type { KnowledgeMimeType } from '@offerleap/shared';
import { extractRawText } from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

const DOCX: KnowledgeMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * @description Detects an upload's type from its bytes (PDF, DOCX) or, for plain text, checks it really is
 * UTF-8 text without binary data, using the extension only to tell `.md` from `.txt`.
 * @param data - File contents.
 * @param fileName - Original name (for .md vs .txt).
 * @returns The type, or null when unsupported.
 */
export function detectKnowledgeType(data: Buffer, fileName: string): KnowledgeMimeType | null {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (
    data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    data.includes('word/document.xml')
  ) {
    return DOCX;
  }
  const looksLikeText =
    data.length > 0 && !data.includes(0) && Buffer.from(data.toString('utf8'), 'utf8').equals(data);
  if (!looksLikeText) return null;
  return /\.(md|markdown)$/i.test(fileName) ? 'text/markdown' : 'text/plain';
}

/**
 * @description Extracts plain text locally — no AI call: pdf.js (unpdf) for PDFs, mammoth for DOCX.
 * Scanned PDFs (images only) yield no text and are reported as empty by the caller.
 * @param data - File contents.
 * @param type - Detected type.
 */
export async function extractDocumentText(data: Buffer, type: KnowledgeMimeType): Promise<string> {
  if (type === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (type === DOCX) return (await extractRawText({ buffer: data })).value;
  return data.toString('utf8');
}
