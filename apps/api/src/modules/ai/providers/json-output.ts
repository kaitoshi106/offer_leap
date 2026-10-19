import { z } from 'zod';

import { AiInvalidOutputError } from '../ai.errors';

/**
 * @description JSON Schema sent to the model for structured output. `$schema` is dropped because Gemini rejects
 * unknown top-level keywords.
 * @param schema - Zod schema of the expected answer.
 */
export function toResponseJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return jsonSchema;
}

/**
 * @description Parses and validates the model's text answer. Structured output makes invalid JSON rare, but the
 * answer is still untrusted, so it is checked like any other input.
 * @param text - Raw text from the model.
 * @param schema - Expected shape.
 * @throws AiInvalidOutputError when the text is empty, not JSON, or doesn't match the schema.
 */
export function parseJsonOutput<T>(text: string | undefined, schema: z.ZodType<T>): T {
  if (!text) throw new AiInvalidOutputError('Empty answer');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiInvalidOutputError('Answer is not JSON');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new AiInvalidOutputError(`Answer does not match the schema: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
