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
  /** Models found not to support the MINIMAL thinking level. */
  private readonly lowThinkingModels = new Set<string>();

  constructor(private readonly options: GeminiProviderOptions) {}

  async generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
    const contents = [{ role: 'user', parts: toGeminiParts(request.parts) }];
    const responseJsonSchema = toResponseJsonSchema(request.schema);

    return this.withModels(request.task, async (model, thinkingLevel) => {
      const response = await this.options.client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: request.system,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema,
          thinkingConfig: { thinkingLevel },
          maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });
      return {
        data: parseJsonOutput(response.text, request.schema),
        model,
        usage: toUsage(response.usageMetadata),
      };
    });
  }

  async streamText(request: AiTextRequest): Promise<AiTextStream> {
    const contents = [{ role: 'user', parts: toGeminiParts(request.parts) }];

    return this.withModels(request.task, async (model, thinkingLevel) => {
      const stream = await this.options.client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: request.system,
          temperature: request.temperature ?? 0.7,
          thinkingConfig: { thinkingLevel },
          maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });
      const iterator = stream[Symbol.asyncIterator]();
      // Overload errors often surface on the first chunk rather than on the call itself, so read it here,
      // while switching to another model is still possible.
      const first = await iterator.next();

      const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
      async function* chunks(): AsyncGenerator<string> {
        let current = first;
        while (!current.done) {
          // Every chunk carries the running totals; the last one is final.
          if (current.value.usageMetadata) Object.assign(usage, toUsage(current.value.usageMetadata));
          if (current.value.text) yield current.value.text;
          current = await iterator.next();
        }
      }
      return { model, chunks: chunks(), usage: () => usage };
    });
  }

  /**
   * @description Tries each model in order until one answers. Busy models are skipped; a model that rejects the
   * MINIMAL thinking level (not every model supports it) is retried at once with LOW and remembered.
   * @param task - For logs.
   * @param attempt - One request to one model.
   * @throws AiUnavailableError when every model is busy; other errors (bad request, bad key) at once.
   */
  private async withModels<T>(
    task: string,
    attempt: (model: string, thinkingLevel: ThinkingLevel) => Promise<T>,
  ): Promise<T> {
    for (const model of this.options.models) {
      try {
        try {
          return await attempt(model, this.thinkingLevel(model));
        } catch (error) {
          if (!this.rejectsMinimalThinking(error)) throw error;
          this.lowThinkingModels.add(model);
          this.logger.warn(`${task}: ${model} does not support MINIMAL thinking, using LOW`);
          return await attempt(model, ThinkingLevel.LOW);
        }
      } catch (error) {
        if (!this.isRetryable(error)) throw error;
        this.logger.warn(`${task}: ${model} unavailable (${this.describe(error)}), trying next model`);
      }
    }
    throw new AiUnavailableError(`No Gemini model available for ${task}`);
  }

  /**
   * Extraction-style tasks need almost no reasoning. Measured on a one-page CV: LOW took ~80 s, MINIMAL ~9 s with
   * the same answer — so MINIMAL wherever the model supports it.
   */
  private thinkingLevel(model: string): ThinkingLevel {
    return this.lowThinkingModels.has(model) ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;
  }

  private rejectsMinimalThinking(error: unknown): boolean {
    return error instanceof ApiError && error.status === 400 && /thinking level/i.test(error.message);
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
