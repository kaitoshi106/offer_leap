import { type CompressRequest, type CompressResponse, isCompressible, jpegName } from './image-compression';

/** What happened to a file before upload. */
export interface PreparedResume {
  file: File;
  /** Set when a photo was shrunk: sizes before and after, for feedback or logs. */
  compressed?: { from: number; to: number };
}

/** A photo that takes longer than this is sent as it is rather than holding up the upload. */
const TIMEOUT_MS = 15_000;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (response: CompressResponse) => void>();

/** Whether this browser can do the work off the main thread; if not, files are sent untouched. */
const supported = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

/**
 * @description The worker, created on first use and kept for the next photos (starting one costs a few ms and a
 * script download). Answers are matched to requests by `id`, so several compressions can be in flight.
 */
function getWorker(): Worker {
  if (worker) return worker;
  // `new URL(…, import.meta.url)` lets the bundler (Turbopack/webpack) emit the worker as its own chunk.
  worker = new Worker(new URL('./compress-image.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<CompressResponse>) => {
    pending.get(data.id)?.(data);
    pending.delete(data.id);
  };
  worker.onerror = () => {
    // The script itself failed (e.g. not loadable): answer everyone with an error and start afresh next time.
    for (const [id, resolve] of pending) resolve({ id, status: 'error', message: 'Worker failed' });
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function askWorker(file: File): Promise<CompressResponse> {
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ id, status: 'error', message: 'Timed out' });
    }, TIMEOUT_MS);
    pending.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
    const request: CompressRequest = { id, file };
    // A File is cloned cheaply: it is a handle to the data, not a copy of it.
    getWorker().postMessage(request);
  });
}

/**
 * @description Makes a CV ready to upload: photos (JPEG, PNG, WebP) are scaled down and re-encoded in a Web
 * Worker; PDF and DOCX pass through. Never fails: any problem (no support, error, timeout) sends the original.
 * @param file - What the user picked.
 */
export async function prepareResumeFile(file: File): Promise<PreparedResume> {
  if (!isCompressible(file.type) || !supported()) return { file };
  const response = await askWorker(file);
  logOutcome(file, response);
  if (response.status !== 'compressed') return { file };
  const compressed = new File([response.bytes], jpegName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
  return { file: compressed, compressed: { from: file.size, to: compressed.size } };
}

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * @description Dev only: prints what the worker did with a photo, so compression can be checked in the console.
 * `NODE_ENV` is inlined at build time, so this is removed from production bundles.
 * @param file - The photo the user picked.
 * @param response - The worker's answer.
 */
function logOutcome(file: File, response: CompressResponse) {
  if (process.env.NODE_ENV !== 'development') return;
  const label = `[CV compression] ${file.name}`;
  if (response.status === 'compressed') {
    const to = response.bytes.byteLength;
    const saved = Math.round((1 - to / file.size) * 100);
    console.info(
      `${label}: ${formatBytes(file.size)} → ${formatBytes(to)} (−${saved}%), ${response.width}×${response.height} JPEG`,
    );
  } else if (response.status === 'kept') {
    console.info(`${label}: kept as is (${formatBytes(file.size)}, already small or JPEG would be larger)`);
  } else {
    console.warn(`${label}: sent uncompressed — ${response.message}`);
  }
}

/** For tests: forget the worker so the next call creates a new one. */
export function resetCompressionWorker() {
  worker?.terminate();
  worker = null;
  pending.clear();
}
