import type { ErrorCode, ResumeMimeType, ResumeSuggestions, ResumeSummary } from '@offerleap/shared';

import type { Resume } from '../../generated/prisma/client';

/**
 * @description API shape of a stored CV. Storage details (path, token counts) stay on the server.
 * @param resume - Database row.
 */
export function toResumeSummary(resume: Resume): ResumeSummary {
  return {
    id: resume.id,
    fileName: resume.fileName,
    // Detected from the bytes at upload, so always one of the accepted types.
    mimeType: resume.mimeType as ResumeMimeType,
    status: resume.status,
    // Written only by the worker after validation, so the cast is safe.
    suggestions: (resume.suggestions as ResumeSuggestions | null) ?? null,
    errorCode: (resume.errorCode as ErrorCode | null) ?? null,
    createdAt: resume.createdAt.toISOString(),
  };
}
