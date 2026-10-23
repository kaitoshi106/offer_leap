import { describe, expect, it } from 'vitest';

import { zip } from '../../common/files/zip.fixture';
import { detectKnowledgeType, extractDocumentText } from './text-extraction';

describe('detectKnowledgeType', () => {
  it.each([
    ['PDF by its bytes', Buffer.from('%PDF-1.7 …'), 'notes.txt', 'application/pdf'],
    ['UTF-8 text', Buffer.from('Dự án thanh toán'), 'notes.txt', 'text/plain'],
    ['Markdown by extension', Buffer.from('# Dự án'), 'README.md', 'text/markdown'],
    ['binary data', Buffer.from([0x00, 0x01, 0x02, 0xff]), 'notes.txt', null],
    ['invalid UTF-8', Buffer.from([0xc3, 0x28]), 'notes.txt', null],
    ['an empty file', Buffer.alloc(0), 'notes.txt', null],
    [
      'a Word file',
      zip({ 'word/document.xml': Buffer.from('<w:document/>') }),
      'cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['a Word "zip bomb"', zip({ 'word/document.xml': Buffer.alloc(80 * 1024 * 1024) }), 'cv.docx', null],
  ])('%s', (_case, data, name, type) => {
    expect(detectKnowledgeType(data, name)).toBe(type);
  });
});

describe('extractDocumentText', () => {
  it('reads plain text as UTF-8', async () => {
    expect(await extractDocumentText(Buffer.from('Chứng chỉ AWS'), 'text/plain')).toBe('Chứng chỉ AWS');
  });
});
