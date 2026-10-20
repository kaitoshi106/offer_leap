import type { z } from 'zod';

/** Piece of input sent to the model: plain text, or a file the model reads natively (PDF, image). */
export type AiContentPart = { type: 'text'; text: string } | { type: 'file'; mimeType: string; data: Buffer };

export interface AiJsonRequest<T> {
  /** Who the call is for: counted against their quota and logged. */
  userId: string;
  /** Prompt id + version, e.g. `resume-extraction.v2`. Logged, and used by the mock provider to pick an answer. */
  task: string;
  /** Fixed instructions. Untrusted content goes in `parts`, never here. */
  system: string;
  parts: AiContentPart[];
  /** Shape of the answer: sent to the model as JSON Schema and used again to validate what comes back. */
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  /** Answer + thinking tokens (both are billed as output). */
  outputTokens: number;
}

export interface AiJsonResult<T> {
  data: T;
  /** Model that actually answered (may be a fallback). */
  model: string;
  usage: AiUsage;
}

export interface AiTextRequest {
  userId: string;
  task: string;
  system: string;
  parts: AiContentPart[];
  /** 0 = deterministic; writing tasks use more to sound natural. */
  temperature?: number;
  maxOutputTokens?: number;
}

/** A text answer arriving piece by piece. */
export interface AiTextStream {
  /** Model that is answering (may be a fallback). */
  model: string;
  chunks: AsyncIterable<string>;
  /** Token usage, complete once `chunks` is exhausted. */
  usage: () => AiUsage;
}

/** One implementation per vendor (Strategy pattern); the rest of the app only sees this interface. */
export interface AiProvider {
  readonly name: string;
  /**
   * @description Asks the model for a JSON answer matching `request.schema`.
   * @throws AiUnavailableError when no model could answer (overloaded, rate-limited, network) — worth retrying.
   * @throws AiInvalidOutputError when the answer is empty or doesn't match the schema.
   */
  generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>>;
  /**
   * @description Streams a free-text answer. Resolves once the first piece has arrived, so "no model available"
   * is still reported as an error before anything was sent to the client.
   * @throws AiUnavailableError when no model could start answering.
   */
  streamText(request: AiTextRequest): Promise<AiTextStream>;
}

/**
 * Nest injection token for the provider feature modules use: the vendor wrapped with quota checks and usage
 * logging (`TrackedAiProvider`).
 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** The raw vendor provider (Gemini or mock). Tests replace this one, so tracking stays under test. */
export const AI_VENDOR = Symbol('AI_VENDOR');
