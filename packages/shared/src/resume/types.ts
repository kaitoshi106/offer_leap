import type { ErrorCode } from '../errors/error-codes';
import type { CareerLevel } from '../profile/constants';
import type { ResumeMimeType, ResumeStatus } from './constants';

/** Profile fields the AI could read from a CV. Codes are guaranteed to exist in the taxonomies. */
export interface ResumeSuggestions {
  fullName: string | null;
  phone: string | null;
  provinceCode: string | null;
  industryCode: string | null;
  jobTitle: string | null;
  level: CareerLevel | null;
  yearsOfExperience: number | null;
  skills: string[];
  /** Fields the AI marked as unsure — the UI asks the user to double-check them. */
  uncertainFields: (keyof Omit<ResumeSuggestions, 'uncertainFields'>)[];
}

/** An uploaded CV and the state of its AI parsing. */
export interface ResumeSummary {
  id: string;
  fileName: string;
  /** Detected from the file's bytes; tells the client how to show it. */
  mimeType: ResumeMimeType;
  status: ResumeStatus;
  suggestions: ResumeSuggestions | null;
  /** Why parsing failed (`RESUME_PARSE_FAILED`, `AI_UNAVAILABLE`…). */
  errorCode: ErrorCode | null;
  createdAt: string;
  /** Analyses that used this CV (they are deleted with it). Only in `GET /resumes`. */
  analysisCount?: number;
  /** Only in `POST /resumes`: the same file was already uploaded, so that CV is returned instead of a copy. */
  reused?: boolean;
}

/** `GET /resumes/{id}/preview`: a DOCX converted to HTML, since browsers can't show Word files. */
export interface ResumePreview {
  html: string;
}
