import type { Locale } from '../constants/app';
import type { InterviewStatus, InterviewType } from './constants';

export interface InterviewQuestion {
  index: number;
  question: string;
  /** What the question assesses, e.g. "conflict resolution", "React rendering". */
  focus: string;
  answer: string | null;
  skipped: boolean;
  /** 0–10, set once answered (0 when skipped). */
  score: number | null;
  feedback: string | null;
  /** A stronger answer the candidate could give. */
  betterAnswer: string | null;
}

export interface InterviewSummary {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

/** Row in the interview history. */
export interface InterviewListItem {
  id: string;
  jobTitle: string;
  type: InterviewType;
  status: InterviewStatus;
  questionCount: number;
  answeredCount: number;
  overallScore: number | null;
  createdAt: string;
}

/** `GET /interviews/:id`. */
export interface InterviewDetail extends InterviewListItem {
  applicationId: string | null;
  jobDescription: string | null;
  locale: Locale;
  questions: InterviewQuestion[];
  result: InterviewSummary | null;
}
