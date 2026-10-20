import type { ApplicationStatus } from './constants';

/** A card on the board. */
export interface ApplicationSummary {
  id: string;
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  position: number;
  /** Score of the linked analysis, if any. */
  score: number | null;
  hasCoverLetter: boolean;
  updatedAt: string;
}

/** `GET /applications/:id`. */
export interface ApplicationDetail extends ApplicationSummary {
  jobUrl: string | null;
  jobDescription: string | null;
  notes: string | null;
  coverLetter: string | null;
  analysisId: string | null;
  createdAt: string;
}
