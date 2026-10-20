import { z } from 'zod';

import { ValidationRule } from '../validation/rules';
import { KNOWLEDGE_LIMITS } from './constants';

const titleSchema = z
  .string({ error: ValidationRule.REQUIRED })
  .trim()
  .min(1, { error: ValidationRule.REQUIRED })
  .max(KNOWLEDGE_LIMITS.titleMax, { error: ValidationRule.TOO_LONG });

/** `POST /knowledge/text`: a pasted note (project description, certificate, achievements…). */
export const createTextDocumentSchema = z.object({
  title: titleSchema,
  content: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(KNOWLEDGE_LIMITS.contentMin, { error: ValidationRule.TOO_SHORT })
    .max(KNOWLEDGE_LIMITS.chars, { error: ValidationRule.TOO_LONG }),
});

/** `GET /knowledge/search?q=&limit=`: try what retrieval finds. */
export const knowledgeSearchSchema = z.object({
  q: z
    .string({ error: ValidationRule.REQUIRED })
    .trim()
    .min(2, { error: ValidationRule.TOO_SHORT })
    .max(KNOWLEDGE_LIMITS.queryMax, { error: ValidationRule.TOO_LONG }),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export type CreateTextDocumentInput = z.infer<typeof createTextDocumentSchema>;
export type KnowledgeSearchInput = z.input<typeof knowledgeSearchSchema>;
export type KnowledgeSearch = z.output<typeof knowledgeSearchSchema>;
