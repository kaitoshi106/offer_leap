import type { Locale } from '../constants/app';
import type { ErrorCode } from '../errors/error-codes';
import type { KnowledgeCitation } from '../knowledge/types';
import type { ResumeStatus } from '../resume/constants';
import type { SkillImportance } from './constants';

export interface MissingSkill {
  name: string;
  importance: SkillImportance;
}

/** What the AI concluded about a CV against a job description. Texts are in the requested locale. */
export interface AnalysisResult {
  /** 0–100: how well the CV fits the role. */
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: MissingSkill[];
  strengths: string[];
  gaps: string[];
  /** Concrete edits to make the CV fit this job better. */
  suggestions: string[];
  /** Passages from the user's own documents the AI was given (absent on analyses made before documents existed). */
  sources?: KnowledgeCitation[];
}

/** Row in the analysis history. Analyses run in the background like CV parsing, so they share its statuses. */
export interface AnalysisSummary {
  id: string;
  status: ResumeStatus;
  /** Read from the job description by the AI; null until the analysis completes. */
  jobTitle: string | null;
  company: string | null;
  score: number | null;
  resumeFileName: string;
  createdAt: string;
}

/** `GET /analyses/:id`. */
export interface AnalysisDetail extends AnalysisSummary {
  resumeId: string;
  jobDescription: string;
  locale: Locale;
  result: AnalysisResult | null;
  errorCode: ErrorCode | null;
}
