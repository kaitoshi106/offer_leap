import {
  ApiError,
  type GenerateContentResponse,
  type GoogleGenAI,
  type Part,
  ThinkingLevel,
} from '@google/genai';
import { Logger } from '@nestjs/common';

import { AiUnavailableError } from '../ai.errors';
import type {
  AiContentPart,
  AiEmbedRequest,
  AiEmbedResult,
  AiJsonRequest,
  AiJsonResult,
  AiProvider,
  AiTextRequest,
  AiTextStream,
  AiUsage,
} from '../ai.types';
import { EMBEDDING_DIMENSIONS } from '../ai.types';
import { parseJsonOutput, toResponseJsonSchema } from './json-output';
import { normalize } from './vectors';

/** Statuses meaning "this model can't take the request right now" → try the next model. */
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const REQUEST_TIMEOUT_MS = 60_000;
/** A stream that goes silent this long after its first chunk is given up (a long letter may take minutes). */
const STREAM_IDLE_TIMEOUT_MS = 30_000;

const timeoutReason = () => new DOMException('The AI stopped answering', 'TimeoutError');
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
  /** Embedding model. No fallback: vectors from different models aren't comparable. */
  embeddingModel?: string;
}

/** Texts per embedding request (API limit is 100). */
const EMBED_BATCH = 50;
const EMBED_ATTEMPTS = 3;

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
  /**
   * Measured with gemini-embedding-001 (768-d), query vs document embeddings: related pairs 0.65–0.76 (e.g. an
   * English GraphQL job vs a Vietnamese GraphQL project note 0.65), unrelated 0.50–0.60 (a hobby note ≤ 0.55).
   * Same-type pairs score much higher (≈ 0.93), so the floor must be calibrated on query↔document pairs.
   */
  readonly similarityFloor = 0.62;
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
      // One controller per stream: it times out the wait for the first chunk, then any long silence between
      // chunks (not the stream as a whole), and stops the generation when the reader goes away.
      const controller = new AbortController();
      let timer = setTimeout(() => controller.abort(timeoutReason()), REQUEST_TIMEOUT_MS);
      const waitForNext = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(timeoutReason()), STREAM_IDLE_TIMEOUT_MS);
      };

      let iterator: AsyncIterator<GenerateContentResponse>;
      let first: IteratorResult<GenerateContentResponse>;
      try {
        const stream = await this.options.client.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: request.system,
            temperature: request.temperature ?? 0.7,
            thinkingConfig: { thinkingLevel },
            maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            abortSignal: controller.signal,
          },
        });
        iterator = stream[Symbol.asyncIterator]();
        // Overload errors often surface on the first chunk rather than on the call itself, so read it here,
        // while switching to another model is still possible.
        first = await iterator.next();
      } catch (error) {
        clearTimeout(timer);
        controller.abort();
        throw error;
      }
      waitForNext();

      const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
      async function* chunks(): AsyncGenerator<string> {
        let finished = false;
        try {
          let current = first;
          while (!current.done) {
            // Every chunk carries the running totals; the last one is final.
            if (current.value.usageMetadata) Object.assign(usage, toUsage(current.value.usageMetadata));
            if (current.value.text) yield current.value.text;
            current = await iterator.next();
            waitForNext();
          }
          finished = true;
        } finally {
          clearTimeout(timer);
          // The reader stopped early (the user left, or an error): stop generating — and paying — upstream.
          if (!finished) {
            controller.abort();
            void iterator.return?.().catch(() => undefined);
          }
        }
      }
      return { model, chunks: chunks(), usage: () => usage };
    });
  }

  async embed(request: AiEmbedRequest): Promise<AiEmbedResult> {
    const model = this.options.embeddingModel ?? 'gemini-embedding-001';
    const vectors: number[][] = [];
    for (let start = 0; start < request.texts.length; start += EMBED_BATCH) {
      const batch = request.texts.slice(start, start + EMBED_BATCH);
      const response = await this.withRetry(request.task, () =>
        this.options.client.models.embedContent({
          model,
          contents: batch,
          config: {
            taskType: request.purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            outputDimensionality: EMBEDDING_DIMENSIONS,
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        }),
      );
      // Shortened (768-d) embeddings aren't unit length; normalising makes cosine similarity comparable.
      vectors.push(...(response.embeddings ?? []).map((embedding) => normalize(embedding.values ?? [])));
    }
    if (vectors.length !== request.texts.length)
      throw new AiUnavailableError('Incomplete embedding response');
    // The embedding API reports no token usage.
    return { vectors, model, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  /** Same model, a few tries with a short pause: there is no other model whose vectors would be compatible. */
  private async withRetry<T>(task: string, call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await call();
      } catch (error) {
        if (!this.isRetryable(error)) throw error;
        if (attempt >= EMBED_ATTEMPTS)
          throw new AiUnavailableError(`Embedding model unavailable for ${task}`);
        this.logger.warn(`${task}: embedding model busy (${this.describe(error)}), retrying`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
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
    // Our per-request timeout surfaces as TimeoutError or, through the SDK, as AbortError (found by the eval: a slow
    // fallback model timed out and the last model was never tried). TypeError = network failure in fetch.
    return error instanceof Error && ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name);
  }

  private describe(error: unknown): string {
    if (error instanceof ApiError) return `HTTP ${error.status}`;
    return error instanceof Error ? error.name : 'unknown error';
  }
}
