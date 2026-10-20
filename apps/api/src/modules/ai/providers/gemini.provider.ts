import { ApiError, type GoogleGenAI, type Part, ThinkingLevel } from '@google/genai';
import { Logger } from '@nestjs/common';

import { AiUnavailableError } from '../ai.errors';
import type {
  AiContentPart,
  AiJsonRequest,
  AiJsonResult,
  AiProvider,
  AiTextRequest,
  AiTextStream,
  AiUsage,
} from '../ai.types';
import { parseJsonOutput, toResponseJsonSchema } from './json-output';

/** Statuses meaning "this model can't take the request right now" → try the next model. */
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

/** Answer + thinking tokens are both billed as output. */
const toUsage = (usage: GeminiUsage | undefined): AiUsage => ({
  inputTokens: usage?.promptTokenCount ?? 0,
  outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
});

export interface GeminiProviderOptions {
  client: Pick<GoogleGenAI, 'models'>;
  /** Main model first, then fallbacks. */
  models: string[];
}

/**
 * @description Converts our content parts to Gemini's: files are sent inline (base64), which Gemini reads
 * natively — PDFs page by page, images with built-in OCR — so no separate OCR tool is needed.
 * @param parts - Provider-neutral parts.
 */
function toGeminiParts(parts: AiContentPart[]): Part[] {
  return parts.map((part) =>
    part.type === 'text'
      ? { text: part.text }
      : { inlineData: { mimeType: part.mimeType, data: part.data.toString('base64') } },
  );
}

/** Google Gemini via `@google/genai`, with structured JSON output and model fallback. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly options: GeminiProviderOptions) {}

  async generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
    const contents = [{ role: 'user', parts: toGeminiParts(request.parts) }];
    const responseJsonSchema = toResponseJsonSchema(request.schema);

    for (const model of this.options.models) {
      let response;
      try {
        response = await this.options.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: request.system,
            temperature: 0,
            responseMimeType: 'application/json',
            responseJsonSchema,
            // Extraction needs almost no reasoning. Measured on a 1-page CV: LOW took ~80 s, MINIMAL ~9 s with the
            // same answer.
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        });
      } catch (error) {
        if (this.isRetryable(error)) {
          this.logger.warn(
            `${request.task}: ${model} unavailable (${this.describe(error)}), trying next model`,
          );
          continue;
        }
        throw error;
      }

      return {
        data: parseJsonOutput(response.text, request.schema),
        model,
        usage: toUsage(response.usageMetadata),
      };
    }

    throw new AiUnavailableError(`No Gemini model available for ${request.task}`);
  }

  async streamText(request: AiTextRequest): Promise<AiTextStream> {
    const contents = [{ role: 'user', parts: toGeminiParts(request.parts) }];

    for (const model of this.options.models) {
      let iterator: AsyncIterator<{ text?: string; usageMetadata?: GeminiUsage }>;
      let first: IteratorResult<{ text?: string; usageMetadata?: GeminiUsage }>;
      try {
        const stream = await this.options.client.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: request.system,
            temperature: request.temperature ?? 0.7,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        });
        iterator = stream[Symbol.asyncIterator]();
        // Overload errors often surface on the first chunk rather than on the call itself.
        first = await iterator.next();
      } catch (error) {
        if (this.isRetryable(error)) {
          this.logger.warn(
            `${request.task}: ${model} unavailable (${this.describe(error)}), trying next model`,
          );
          continue;
        }
        throw error;
      }

      const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
      const track = (chunk: { usageMetadata?: GeminiUsage }) => {
        // Every chunk carries the running totals; the last one is final.
        if (chunk.usageMetadata) Object.assign(usage, toUsage(chunk.usageMetadata));
      };
      async function* chunks(): AsyncGenerator<string> {
        let current = first;
        while (!current.done) {
          track(current.value);
          if (current.value.text) yield current.value.text;
          current = await iterator.next();
        }
      }
      return { model, chunks: chunks(), usage: () => usage };
    }

    throw new AiUnavailableError(`No Gemini model available for ${request.task}`);
  }

  /** Busy/rate-limited models, timeouts and network failures are worth another try; bad requests are not. */
  private isRetryable(error: unknown): boolean {
    if (error instanceof ApiError) return RETRYABLE_STATUSES.has(error.status);
    return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'TypeError');
  }

  private describe(error: unknown): string {
    if (error instanceof ApiError) return `HTTP ${error.status}`;
    return error instanceof Error ? error.name : 'unknown error';
  }
}
