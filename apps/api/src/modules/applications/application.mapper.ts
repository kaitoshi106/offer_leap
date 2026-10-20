import type { ApplicationDetail, ApplicationSummary } from '@offerleap/shared';

import type { JobApplication } from '../../generated/prisma/client';

type ApplicationRow = JobApplication & { analysis: { score: number | null } | null };

/** Prisma `include` that loads what the mappers need. */
export const APPLICATION_INCLUDE = { analysis: { select: { score: true } } } as const;

export function toApplicationSummary(application: ApplicationRow): ApplicationSummary {
  return {
    id: application.id,
    company: application.company,
    jobTitle: application.jobTitle,
    status: application.status,
    position: application.position,
    score: application.analysis?.score ?? null,
    hasCoverLetter: Boolean(application.coverLetter),
    updatedAt: application.updatedAt.toISOString(),
  };
}

export function toApplicationDetail(application: ApplicationRow): ApplicationDetail {
  return {
    ...toApplicationSummary(application),
    jobUrl: application.jobUrl,
    jobDescription: application.jobDescription,
    notes: application.notes,
    coverLetter: application.coverLetter,
    analysisId: application.analysisId,
    createdAt: application.createdAt.toISOString(),
  };
}
