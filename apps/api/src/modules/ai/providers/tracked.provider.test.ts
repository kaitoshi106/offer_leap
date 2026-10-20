import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AiQuotaExceededError, AiUnavailableError } from '../ai.errors';
import type { AiProvider } from '../ai.types';
import { TrackedAiProvider } from './tracked.provider';

function setup(vendor: Partial<AiProvider>, { quotaLeft = true } = {}) {
  const create = vi.fn().mockResolvedValue({});
  const quota = {
    assertAvailable: vi.fn(async () => {
      if (!quotaLeft) throw new AiQuotaExceededError('used up');
    }),
  };
  const provider = new TrackedAiProvider(
    { name: 'fake', generateJson: vi.fn(), streamText: vi.fn(), ...vendor } as AiProvider,
    quota as never,
    { aiUsageLog: { create } } as never,
  );
  return { provider, create, quota };
}

const jsonRequest = { userId: 'u1', task: 'test.v1', system: 's', parts: [], schema: z.object({}) };
const textRequest = { userId: 'u1', task: 'letter.v1', system: 's', parts: [] };

describe('TrackedAiProvider', () => {
  it('records a successful call with model, tokens and latency', async () => {
    const { provider, create } = setup({
      generateJson: vi
        .fn()
        .mockResolvedValue({ data: {}, model: 'm1', usage: { inputTokens: 10, outputTokens: 5 } }),
    });

    await provider.generateJson(jsonRequest);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        task: 'test.v1',
        model: 'm1',
        inputTokens: 10,
        outputTokens: 5,
        success: true,
        errorType: null,
        latencyMs: expect.any(Number),
      }),
    });
  });

  it('records a failed call and rethrows the error', async () => {
    const { provider, create } = setup({
      generateJson: vi.fn().mockRejectedValue(new AiUnavailableError('busy')),
    });

    await expect(provider.generateJson(jsonRequest)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(create.mock.calls[0]![0].data).toMatchObject({
      success: false,
      errorType: 'AiUnavailableError',
      model: null,
    });
  });

  it('refuses before calling the vendor when the quota is used up (and records nothing)', async () => {
    const generateJson = vi.fn();
    const { provider, create } = setup({ generateJson }, { quotaLeft: false });

    await expect(provider.generateJson(jsonRequest)).rejects.toBeInstanceOf(AiQuotaExceededError);
    expect(generateJson).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('records a stream once it ends, with the final usage', async () => {
    async function* chunks() {
      yield 'Dear ';
      yield 'team';
    }
    const { provider, create } = setup({
      streamText: vi.fn().mockResolvedValue({
        model: 'm1',
        chunks: chunks(),
        usage: () => ({ inputTokens: 3, outputTokens: 7 }),
      }),
    });

    const stream = await provider.streamText(textRequest);
    expect(create).not.toHaveBeenCalled();
    let text = '';
    for await (const piece of stream.chunks) text += piece;

    expect(text).toBe('Dear team');
    expect(create.mock.calls[0]![0].data).toMatchObject({ success: true, inputTokens: 3, outputTokens: 7 });
  });

  it('records a stream that breaks off as a failure', async () => {
    async function* chunks() {
      yield 'Dear ';
      throw new AiUnavailableError('cut');
    }
    const { provider, create } = setup({
      streamText: vi.fn().mockResolvedValue({
        model: 'm1',
        chunks: chunks(),
        usage: () => ({ inputTokens: 3, outputTokens: 1 }),
      }),
    });

    const stream = await provider.streamText(textRequest);
    await expect(async () => {
      for await (const _piece of stream.chunks) {
        // drain
      }
    }).rejects.toBeInstanceOf(AiUnavailableError);
    expect(create.mock.calls[0]![0].data).toMatchObject({ success: false, errorType: 'AiUnavailableError' });
  });

  it('never fails the call because logging failed', async () => {
    const { provider, create } = setup({
      generateJson: vi
        .fn()
        .mockResolvedValue({ data: { ok: true }, model: 'm1', usage: { inputTokens: 1, outputTokens: 1 } }),
    });
    create.mockRejectedValue(new Error('db down'));
    await expect(provider.generateJson(jsonRequest)).resolves.toMatchObject({ data: { ok: true } });
  });
});
