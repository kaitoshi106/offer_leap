import { describe, expect, it } from 'vitest';

import { detectResumeType } from './resume-file';

const bytes = (...values: (number | string)[]) =>
  Buffer.concat(
    values.map((value) => (typeof value === 'string' ? Buffer.from(value) : Buffer.from([value]))),
  );

describe('detectResumeType', () => {
  it.each([
    ['PDF', bytes('%PDF-1.7\n'), 'application/pdf'],
    ['PNG', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0), 'image/png'],
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    ['WEBP', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'image/webp'],
    [
      'DOCX',
      bytes('PK', 3, 4, '....word/document.xml....'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])('recognises %s', (_name, data, type) => {
    expect(detectResumeType(data)).toBe(type);
  });

  it.each([
    ['plain text renamed to .pdf', bytes('hello, this is not a pdf')],
    ['a ZIP that is not a Word file', bytes('PK', 3, 4, 'xl/workbook.xml')],
    ['RIFF audio', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ')],
    ['an empty file', Buffer.alloc(0)],
  ])('rejects %s', (_name, data) => {
    expect(detectResumeType(data)).toBeNull();
  });
});
