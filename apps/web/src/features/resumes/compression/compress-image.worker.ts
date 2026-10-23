/**
 * Runs off the main thread: decoding a 12-megapixel photo and re-encoding it takes hundreds of milliseconds, which
 * on the page would freeze scrolling, typing and animations. Here the page stays responsive meanwhile.
 */
import {
  type CompressRequest,
  type CompressResponse,
  fitWithin,
  isAlreadySmall,
  JPEG_QUALITY,
} from './image-compression';

/**
 * The worker's global scope, typed by hand: `/// <reference lib="webworker" />` would apply worker types to the
 * whole project (TypeScript libs are global) and break `window` typings elsewhere.
 */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<CompressRequest>) => void) | null;
  postMessage: (message: CompressResponse, transfer: Transferable[]) => void;
};

/** Pixel colour behind transparent PNG areas (JPEG has no alpha); image data, not a UI colour. */
const PAPER_WHITE = '#fff';

scope.onmessage = async ({ data }: MessageEvent<CompressRequest>) => {
  const reply = (message: CompressResponse, transfer: Transferable[] = []) =>
    scope.postMessage(message, transfer);
  try {
    // Decodes in the background; `from-image` applies the EXIF orientation, so phone photos come out upright.
    const bitmap = await createImageBitmap(data.file, { imageOrientation: 'from-image' });
    if (isAlreadySmall(data.file.size, bitmap.width, bitmap.height)) {
      bitmap.close();
      return reply({ id: data.id, status: 'kept' });
    }
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D context');
    // JPEG has no transparency: paint the page white first so a transparent PNG doesn't turn black.
    context.fillStyle = PAPER_WHITE;
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    if (blob.size >= data.file.size) return reply({ id: data.id, status: 'kept' });
    const bytes = await blob.arrayBuffer();
    // Transferred, not copied: the buffer moves to the page in O(1) and becomes unusable here.
    reply({ id: data.id, status: 'compressed', bytes, width, height }, [bytes]);
  } catch (error) {
    reply({ id: data.id, status: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
