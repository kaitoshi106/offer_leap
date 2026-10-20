import type {
  AnalysisDetail,
  AnalysisResult,
  AnalysisSummary,
  ErrorCode,
  KnowledgeMatch,
} from '@offerleap/shared';

import type { JobAnalysis, Resume } from '../../generated/prisma/client';
import type { JobMatch } from '../ai/prompts/job-match.v2';

type AnalysisRow = JobAnalysis & { resume: Pick<Resume, 'fileName'> };

/** Prisma `include` that loads what the mappers need. */
export const ANALYSIS_INCLUDE = { resume: { select: { fileName: true } } } as const;

export function toAnalysisSummary(analysis: AnalysisRow): AnalysisSummary {
  return {
    id: analysis.id,
    status: analysis.status,
    jobTitle: analysis.jobTitle,
    company: analysis.company,
    score: analysis.score,
    resumeFileName: analysis.resume.fileName,
    createdAt: analysis.createdAt.toISOString(),
  };
}

export function toAnalysisDetail(analysis: AnalysisRow): AnalysisDetail {
  return {
    ...toAnalysisSummary(analysis),
    resumeId: analysis.resumeId,
    jobDescription: analysis.jobDescription,
    locale: analysis.locale,
    // Written only by the worker after validation, so the cast is safe.
    result: (analysis.result as AnalysisResult | null) ?? null,
    errorCode: (analysis.errorCode as ErrorCode | null) ?? null,
  };
}

/**
 * @description Splits the model's answer into the stored result and the columns lists need. Lists are trimmed
 * and de-duplicated (models sometimes repeat an item), and a skill can't be both matched and missing.
 * @param match - Schema-checked answer.
 * @param notes - Passages the model was given, listed as sources (with a short excerpt).
 */
export function toAnalysisResult(
  match: JobMatch,
  notes: KnowledgeMatch[] = [],
): {
  jobTitle: string;
  company: string | null;
  result: AnalysisResult;
} {
  // Trim, drop empties and case-insensitive duplicates (keeping the first spelling).
  const clean = (items: string[]) => {
    const kept = new Map<string, string>();
    for (const item of items.map((value) => value.trim()).filter(Boolean)) {
      if (!kept.has(item.toLowerCase())) kept.set(item.toLowerCase(), item);
    }
    return [...kept.values()];
  };
  const matchedSkills = clean(match.matchedSkills);
  const matched = new Set(matchedSkills.map((skill) => skill.toLowerCase()));
  const seen = new Set<string>();
  const missingSkills = match.missingSkills
    .map((skill) => ({ ...skill, name: skill.name.trim() }))
    .filter(({ name }) => {
      const key = name.toLowerCase();
      if (!name || matched.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Required gaps first: they matter most.
    .sort((a, b) => Number(b.importance === 'REQUIRED') - Number(a.importance === 'REQUIRED'));

  return {
    jobTitle: match.jobTitle.trim().slice(0, 200),
    company: match.company?.trim().slice(0, 200) || null,
    result: {
      score: match.score,
      summary: match.summary.trim(),
      matchedSkills,
      missingSkills,
      strengths: clean(match.strengths),
      gaps: clean(match.gaps),
      suggestions: clean(match.suggestions),
      sources: notes.map((note) => ({
        documentId: note.documentId,
        title: note.title,
        excerpt: note.content.length > 240 ? `${note.content.slice(0, 240).trimEnd()}…` : note.content,
      })),
    },
  };
}
