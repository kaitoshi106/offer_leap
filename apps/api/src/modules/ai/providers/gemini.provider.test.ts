import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AiInvalidOutputError, AiUnavailableError } from '../ai.errors';
import type { AiJsonRequest } from '../ai.types';
import { GeminiProvider } from './gemini.provider';

const request: AiJsonRequest<{ name: string }> = {
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
