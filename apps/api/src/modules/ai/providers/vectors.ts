import { EMBEDDING_DIMENSIONS } from '../ai.types';

/** Scales a vector to length 1 (cosine similarity then equals the dot product). Zero vectors stay zero. */
export function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((value) => value / length);
}

/** Cosine similarity of two vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!;
  return dot / (Math.hypot(...a) * Math.hypot(...b) || 1);
}

/** pgvector literal: `[0.1,0.2,…]`. */
export const toVectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

/**
 * @description Deterministic "embedding" for tests and offline dev: words (accents removed, lowercased) are
 * hashed into buckets — a bag of words. Texts sharing words get similar vectors, which is enough to test
 * retrieval end to end without a model.
 * @param text - Text to embed.
 */
export function hashEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .match(/[a-z0-9.+#]{2,}/g);
  for (const word of words ?? []) {
    // FNV-1a hash → bucket.
    let hash = 0x811c9dc5;
    for (let i = 0; i < word.length; i += 1) hash = Math.imul(hash ^ word.charCodeAt(i), 0x01000193) >>> 0;
    vector[hash % EMBEDDING_DIMENSIONS]! += 1;
  }
  return normalize(vector);
}
