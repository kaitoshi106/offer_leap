import type { ErrorCode } from '../errors/error-codes';
import type { AiJobStatus } from '../resume/constants';
import type { KnowledgeSource } from './constants';

/** A personal document the AI can draw on. Processed in the background like CVs (same statuses). */
export interface KnowledgeDocument {
  id: string;
  title: string;
  source: KnowledgeSource;
  fileName: string | null;
  status: AiJobStatus;
  errorCode: ErrorCode | null;
  chunkCount: number;
  charCount: number;
  createdAt: string;
}

/** A passage found by retrieval. `score` is cosine similarity (−1…1, higher is closer). */
export interface KnowledgeMatch {
  documentId: string;
  title: string;
  content: string;
  score: number;
  /** At or above the similarity floor: the AI features would be given this passage. */
  relevant: boolean;
}

/** A document passage an AI answer was given as background. */
export interface KnowledgeCitation {
  documentId: string;
  title: string;
  excerpt: string;
}
