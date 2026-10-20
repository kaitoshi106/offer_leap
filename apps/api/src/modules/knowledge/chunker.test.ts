import { describe, expect, it } from 'vitest';

import { chunkText, normalizeText } from './chunker';

describe('normalizeText', () => {
  it('cleans spaces and blank lines', () => {
    expect(normalizeText('  Dự án  X\r\n\r\n\r\n\r\nMô tả\t ngắn  \n')).toBe('Dự án X\n\nMô tả ngắn');
  });
});

describe('chunkText', () => {
  it('keeps short text in one chunk', () => {
    expect(chunkText('Một đoạn ngắn.')).toEqual(['Một đoạn ngắn.']);
    expect(chunkText('')).toEqual([]);
  });

  it('splits long text into overlapping chunks near the target size, on sentence or word boundaries', () => {
    const sentence = 'Tôi xây dựng hệ thống thanh toán bằng NestJS và Kafka cho hàng triệu giao dịch. ';
    const text = sentence.repeat(40).trim();
    const chunks = chunkText(text, { size: 300, overlap: 60 });

    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
      expect(chunk.startsWith(' ')).toBe(false);
    }
    // Neighbouring chunks share some text (overlap).
    const tail = chunks[0]!.slice(-30);
    expect(chunks[1]!.includes(tail.slice(-15).trim().split(' ').at(-1)!)).toBe(true);
    // Every word of the input survives.
    expect(chunks.join(' ')).toContain('triệu giao dịch.');
  });

  it('prefers paragraph breaks', () => {
    const first = 'A'.repeat(200);
    const chunks = chunkText(`${first}\n\n${'B '.repeat(150)}`, { size: 300, overlap: 0 });
    expect(chunks[0]).toBe(first);
  });
});
