import type { ErrorCode, KnowledgeDocument } from '@offerleap/shared';

import type { KnowledgeDocument as DocumentRow } from '../../generated/prisma/client';

/** Database row → the public shape (no storage key, no embedding model). */
export function toKnowledgeDocument(row: DocumentRow): KnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    fileName: row.fileName,
    status: row.status,
    errorCode: (row.errorCode as ErrorCode | null) ?? null,
    chunkCount: row.chunkCount,
    charCount: row.charCount,
    createdAt: row.createdAt.toISOString(),
  };
}
