import type { z } from 'zod';

/** Piece of input sent to the model: plain text, or a file the model reads natively (PDF, image). */
export type AiContentPart = { type: 'text'; text: string } | { type: 'file'; mimeType: string; data: Buffer };

export interface AiJsonRequest<T> {
  /** Prompt id + version, e.g. `resume-extraction.v1`. Logged, and used by the mock provider to pick an answer. */
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

/** One implementation per vendor (Strategy pattern); the rest of the app only sees this interface. */
export interface AiProvider {
  readonly name: string;
  /**
   * @description Asks the model for a JSON answer matching `request.schema`.
   * @throws AiUnavailableError when no model could answer (overloaded, rate-limited, network) — worth retrying.
   * @throws AiInvalidOutputError when the answer is empty or doesn't match the schema.
   */
  generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>>;
}

/** Nest injection token for the configured `AiProvider`. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
