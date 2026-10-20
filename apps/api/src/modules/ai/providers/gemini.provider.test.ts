import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AiInvalidOutputError, AiUnavailableError } from '../ai.errors';
import type { AiJsonRequest } from '../ai.types';
import { GeminiProvider } from './gemini.provider';

const request: AiJsonRequest<{ name: string }> = {
  userId: 'u1',
  task: 'test.v1',
  system: 'Extract the name.',
  parts: [
    { type: 'text', text: 'CV:' },
    { type: 'file', mimeType: 'application/pdf', data: Buffer.from('%PDF-1.7') },
  ],
  schema: z.object({ name: z.string() }),
};

const answer = (text: string | undefined) => ({
  text,
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 15, thoughtsTokenCount: 40 },
});

function setup(...results: unknown[]) {
  const generateContent = vi.fn();
  for (const result of results) {
    if (result instanceof Error) generateContent.mockRejectedValueOnce(result);
    else generateContent.mockResolvedValueOnce(result);
  }
  const provider = new GeminiProvider({
    client: { models: { generateContent } } as never,
    models: ['main-model', 'fallback-model'],
  });
  return { provider, generateContent };
}

describe('GeminiProvider', () => {
  it('requests structured JSON and returns the validated answer with usage', async () => {
    const { provider, generateContent } = setup(answer('{"name":"An"}'));

    const result = await provider.generateJson(request);

    expect(result).toEqual({
      data: { name: 'An' },
      model: 'main-model',
      usage: { inputTokens: 120, outputTokens: 55 },
    });
    const params = generateContent.mock.calls[0]![0];
    expect(params.model).toBe('main-model');
    expect(params.config).toMatchObject({
      systemInstruction: 'Extract the name.',
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object', properties: { name: { type: 'string' } } },
      temperature: 0,
    });
    expect(params.config.responseJsonSchema).not.toHaveProperty('$schema');
    // Files are sent inline as base64.
    expect(params.contents[0].parts[1]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: Buffer.from('%PDF-1.7').toString('base64') },
    });
  });

  it('falls back to the next model when one is overloaded or rate-limited', async () => {
    const { provider, generateContent } = setup(
      new ApiError({ message: 'overloaded', status: 503 }),
      answer('{"name":"An"}'),
    );

    const result = await provider.generateJson(request);

    expect(result.model).toBe('fallback-model');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('reports the provider as unavailable when every model is busy', async () => {
    const { provider } = setup(
      new ApiError({ message: 'overloaded', status: 503 }),
      new ApiError({ message: 'quota', status: 429 }),
    );
    await expect(provider.generateJson(request)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('does not hide request errors behind a fallback', async () => {
    const { provider, generateContent } = setup(new ApiError({ message: 'bad key', status: 400 }));
    await expect(provider.generateJson(request)).rejects.toMatchObject({ status: 400 });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['empty', undefined],
    ['not JSON', 'Sure! The name is An.'],
    ['the wrong shape', '{"fullName":"An"}'],
  ])('rejects an answer that is %s', async (_case, text) => {
    const { provider } = setup(answer(text));
    await expect(provider.generateJson(request)).rejects.toBeInstanceOf(AiInvalidOutputError);
  });
});

describe('GeminiProvider.streamText', () => {
  const textRequest = {
    userId: 'u1',
    task: 'letter.v1',
    system: 'Write a letter.',
    parts: [{ type: 'text' as const, text: 'Hi' }],
  };

  async function* chunks(...items: (Error | { text?: string; usageMetadata?: object })[]) {
    for (const item of items) {
      if (item instanceof Error) throw item;
      yield item;
    }
  }

  function setupStream(...streams: AsyncGenerator<unknown>[]) {
    const generateContentStream = vi.fn();
    for (const stream of streams) generateContentStream.mockResolvedValueOnce(stream);
    const provider = new GeminiProvider({
      client: { models: { generateContentStream } } as never,
      models: ['main-model', 'fallback-model'],
    });
    return { provider, generateContentStream };
  }

  async function collect(iterable: AsyncIterable<string>) {
    let text = '';
    for await (const piece of iterable) text += piece;
    return text;
  }

  it('streams the pieces and reports the final usage', async () => {
    const { provider, generateContentStream } = setupStream(
      chunks(
        { text: 'Dear ', usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 1 } },
        {
          text: 'team',
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 2, thoughtsTokenCount: 3 },
        },
      ),
    );

    const stream = await provider.streamText(textRequest);

    expect(await collect(stream.chunks)).toBe('Dear team');
    expect(stream).toMatchObject({ model: 'main-model' });
    expect(stream.usage()).toEqual({ inputTokens: 50, outputTokens: 5 });
    expect(generateContentStream.mock.calls[0]![0].config).toMatchObject({
      systemInstruction: 'Write a letter.',
    });
  });

  it('falls back when the first chunk reports an overloaded model', async () => {
    const { provider } = setupStream(
      chunks(new ApiError({ message: 'overloaded', status: 503 })),
      chunks({ text: 'Hello' }),
    );

    const stream = await provider.streamText(textRequest);

    expect(stream.model).toBe('fallback-model');
    expect(await collect(stream.chunks)).toBe('Hello');
  });

  it('reports the provider as unavailable when no model can start', async () => {
    const { provider } = setupStream(
      chunks(new ApiError({ message: 'overloaded', status: 503 })),
      chunks(new ApiError({ message: 'quota', status: 429 })),
    );
    await expect(provider.streamText(textRequest)).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe('GeminiProvider thinking level', () => {
  it('retries a model that rejects MINIMAL thinking with LOW, and remembers it', async () => {
    const unsupported = new ApiError({
      message: '{"error":{"code":400,"message":"Thinking level MINIMAL is not supported for this model."}}',
      status: 400,
    });
    const { provider, generateContent } = setup(
      unsupported,
      answer('{"name":"An"}'),
      answer('{"name":"Bình"}'),
    );

    expect((await provider.generateJson(request)).data).toEqual({ name: 'An' });
    expect((await provider.generateJson(request)).data).toEqual({ name: 'Bình' });

    const levels = generateContent.mock.calls.map(([params]) => params.config.thinkingConfig.thinkingLevel);
    expect(levels).toEqual(['MINIMAL', 'LOW', 'LOW']);
    expect(generateContent.mock.calls.every(([params]) => params.model === 'main-model')).toBe(true);
  });
});
