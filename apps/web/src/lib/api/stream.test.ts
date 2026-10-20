import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiStream } from './client';
import { ApiError } from './errors';

const fetchMock = vi.fn<typeof fetch>();

/** A streamed response made of the given byte chunks, optionally breaking off at the end. */
function streamResponse(chunks: Uint8Array[], { breakOff = false } = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (breakOff) controller.error(new TypeError('network error'));
      else controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

describe('apiStream', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('reports the text so far and keeps characters split across chunks intact', async () => {
    const bytes = new TextEncoder().encode('Kính gửi');
    // Cut inside the 2-byte "í" so neither half decodes on its own.
    fetchMock.mockResolvedValue(streamResponse([bytes.slice(0, 2), bytes.slice(2)]));
    const onText = vi.fn();

    const text = await apiStream('/letter', { method: 'POST', body: {}, onText });

    expect(text).toBe('Kính gửi');
    expect(onText).toHaveBeenLastCalledWith('Kính gửi');
    expect(onText.mock.calls.every(([value]) => !value.includes('�'))).toBe(true);
  });

  it('turns a stream that breaks off into STREAM_INTERRUPTED', async () => {
    fetchMock.mockResolvedValue(streamResponse([new TextEncoder().encode('Dear')], { breakOff: true }));
    await expect(apiStream('/letter', { onText: vi.fn() })).rejects.toEqual(
      expect.objectContaining({ code: 'STREAM_INTERRUPTED' }),
    );
  });

  it('reports errors sent before the stream as normal API errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 503, code: 'AI_UNAVAILABLE', message: 'busy' }), {
        status: 503,
      }),
    );
    const error = await apiStream('/letter', { onText: vi.fn() }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'AI_UNAVAILABLE' });
  });
});
