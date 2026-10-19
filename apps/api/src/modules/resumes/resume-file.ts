import type { ResumeMimeType } from '@offerleap/shared';

const startsWith = (data: Buffer, bytes: number[], offset = 0) =>
  data.length >= offset + bytes.length && bytes.every((byte, index) => data[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * @description Detects the real type of an upload from its first bytes ("magic numbers"). The browser's
 * declared type and the file extension are chosen by the client, so neither can be trusted.
 * @param data - File contents.
 * @returns The detected type, or null when it isn't an accepted CV format.
 */
export function detectResumeType(data: Buffer): ResumeMimeType | null {
  if (startsWith(data, ascii('%PDF-'))) return 'application/pdf';
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8)) return 'image/webp';
  // DOCX is a ZIP archive; Word documents contain `word/document.xml`, whose name is stored uncompressed.
  if (startsWith(data, [0x50, 0x4b, 0x03, 0x04]) && data.includes('word/document.xml')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}
