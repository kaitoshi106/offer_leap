import { describe, expect, it } from 'vitest';

import { cosine, hashEmbedding, normalize, toVectorLiteral } from './vectors';

describe('vectors', () => {
  it('normalises to unit length', () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it('makes hash embeddings that are close for texts sharing words, ignoring accents', () => {
    const payments = hashEmbedding('Xây dựng hệ thống thanh toán bằng NestJS và Kafka');
    const query = hashEmbedding('thanh toan kafka');
    const cooking = hashEmbedding('Nấu phở bò ngon');
    // One shared word after removing accents ("hệ thống" vs "truyền thống") already gives ~0.14.
    expect(cosine(payments, hashEmbedding('Nấu phở truyền thống'))).toBeLessThan(0.2);
    expect(payments).toHaveLength(768);
    expect(cosine(payments, query)).toBeGreaterThan(0.3);
    expect(cosine(payments, cooking)).toBeLessThan(0.1);
  });

  it('formats a pgvector literal', () => {
    expect(toVectorLiteral([0.5, -1])).toBe('[0.5,-1]');
  });
});
