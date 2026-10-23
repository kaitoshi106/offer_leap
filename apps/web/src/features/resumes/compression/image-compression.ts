/**
 * Shared by the page and the worker: the rules for shrinking a CV photo, and the messages they exchange.
 * Pure functions only, so they can be unit tested without a browser.
 */

/** Longest side kept: enough for the AI to read small print on an A4 page (~240 dpi on the short side). */
export const MAX_DIMENSION = 2400;
/** JPEG quality: visually lossless for text, a fraction of a phone photo's size. */
export const JPEG_QUALITY = 0.85;
/** Photos smaller than this and already within MAX_DIMENSION are sent as they are. */
export const KEEP_BELOW_BYTES = 1_500_000;

/** Image types worth recompressing (PDF and DOCX are sent untouched). */
export const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const isCompressible = (type: string) => (COMPRESSIBLE_TYPES as readonly string[]).includes(type);

/**
 * @description Size that fits within `max` on its longest side, keeping the aspect ratio; never upscales.
 * @param width - Original width in px.
 * @param height - Original height in px.
 * @param max - Longest side allowed.
 */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * @description Whether an image is already fine to send: small enough and not larger than needed.
 * @param bytes - File size.
 * @param width - Width in px.
 * @param height - Height in px.
 */
export function isAlreadySmall(bytes: number, width: number, height: number): boolean {
  return bytes < KEEP_BELOW_BYTES && Math.max(width, height) <= MAX_DIMENSION;
}

/** "CV scan.PNG" → "CV scan.jpg" (the compressed file is always a JPEG). */
export const jpegName = (name: string) => `${name.replace(/\.[^./]+$/, '') || 'cv'}.jpg`;

/** Page → worker: compress this image. `id` matches the answer to the request. */
export interface CompressRequest {
  id: number;
  file: Blob;
}

/** Worker → page. `kept`: the original is better as it is (small already, or the JPEG came out larger). */
export type CompressResponse =
  | { id: number; status: 'compressed'; bytes: ArrayBuffer; width: number; height: number }
  | { id: number; status: 'kept' }
  | { id: number; status: 'error'; message: string };
