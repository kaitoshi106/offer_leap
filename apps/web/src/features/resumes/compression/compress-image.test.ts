import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareResumeFile, resetCompressionWorker } from './compress-image';
import type { CompressRequest, CompressResponse } from './image-compression';

/** How the fake worker answers. */
let answer: (request: CompressRequest) => CompressResponse;
let created = 0;

/** jsdom has no Web Workers: a stand-in that answers asynchronously, like a real one. */
class FakeWorker {
  onmessage: ((event: MessageEvent<CompressResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    created += 1;
  }
  postMessage(request: CompressRequest) {
    setTimeout(() => this.onmessage?.({ data: answer(request) } as MessageEvent<CompressResponse>), 0);
  }
  terminate() {}
}

const photo = (bytes = 5_000_000) => new File([new Uint8Array(bytes)], 'CV photo.PNG', { type: 'image/png' });

describe('prepareResumeFile', () => {
  beforeEach(() => {
    created = 0;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
  });
  afterEach(() => {
    resetCompressionWorker();
    vi.unstubAllGlobals();
  });

  it('sends PDFs and DOCX files untouched, without starting a worker', async () => {
    const pdf = new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' });
    expect((await prepareResumeFile(pdf)).file).toBe(pdf);
    expect(created).toBe(0);
  });

  it('replaces a photo with the smaller JPEG made by the worker, reusing one worker', async () => {
    answer = ({ id }) => ({
      id,
      status: 'compressed',
      bytes: new ArrayBuffer(800_000),
      width: 2400,
      height: 1800,
    });
    const first = await prepareResumeFile(photo());
    const second = await prepareResumeFile(photo(6_000_000));

    expect(first.file).toMatchObject({ name: 'CV photo.jpg', type: 'image/jpeg', size: 800_000 });
    expect(first.compressed).toEqual({ from: 5_000_000, to: 800_000 });
    expect(second.compressed?.from).toBe(6_000_000);
    expect(created).toBe(1);
  });

  it('falls back to the original when the worker keeps it, fails, or is not supported', async () => {
    const original = photo();
    answer = ({ id }) => ({ id, status: 'kept' });
    expect((await prepareResumeFile(original)).file).toBe(original);

    answer = ({ id }) => ({ id, status: 'error', message: 'decode failed' });
    expect(await prepareResumeFile(original)).toEqual({ file: original });

    vi.stubGlobal('OffscreenCanvas', undefined);
    expect((await prepareResumeFile(original)).file).toBe(original);
  });
});
