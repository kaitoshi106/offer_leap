import { describe, expect, it } from 'vitest';

import { zip } from './zip.fixture';
import { unzippedSizeWithin } from './zip-guard';

describe('unzippedSizeWithin', () => {
  it('measures what the archive really unpacks to', () => {
    const archive = zip({
      'word/document.xml': Buffer.from('<w:document>Hello</w:document>'),
      'a.txt': Buffer.alloc(100),
    });
    expect(unzippedSizeWithin(archive, 1_000)).toBe(130);
  });

  it('stops at the limit instead of unpacking a "zip bomb" into memory', () => {
    // 50 MB of zeros compresses to about 50 KB.
    const bomb = zip({ 'word/document.xml': Buffer.alloc(50 * 1024 * 1024) });
    expect(bomb.length).toBeLessThan(100_000);
    expect(unzippedSizeWithin(bomb, 10 * 1024 * 1024)).toBeNull();
  });

  it('is not fooled by headers that understate the size', () => {
    const lying = zip({ 'word/document.xml': Buffer.alloc(5 * 1024 * 1024) }, 10);
    expect(unzippedSizeWithin(lying, 1024 * 1024)).toBeNull();
  });

  it('rejects data that is not a readable archive', () => {
    expect(unzippedSizeWithin(Buffer.from('PK\u0003\u0004 not really a zip'), 1_000)).toBeNull();
  });
});
