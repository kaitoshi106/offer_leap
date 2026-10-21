import type { AnalysisDetail } from '../analysis/types';
import type { ApplicationDetail } from '../application/types';
import type { AuthUser } from '../auth/types';
import type { InterviewDetail } from '../interview/types';
import type { KnowledgeDocument } from '../knowledge/types';
import type { ProfileValues } from '../profile/types';
import type { ResumeSummary } from '../resume/types';

/** Version of the {@link AccountExport} layout; bumped when fields change meaning. */
export const ACCOUNT_EXPORT_VERSION = 1;

/**
 * `GET /account/export`: everything the user created, as the API shows it. No password hash, tokens, file paths
 * or embeddings; uploaded files themselves are not included (the user has the originals).
 */
export interface AccountExport {
  version: typeof ACCOUNT_EXPORT_VERSION;
  exportedAt: string;
  account: AuthUser & { createdAt: string };
  /** `null` for admins (they have no career profile). */
  profile: ProfileValues | null;
  resumes: ResumeSummary[];
  analyses: AnalysisDetail[];
  applications: ApplicationDetail[];
  interviews: InterviewDetail[];
  /** Each document with its text, as the passages it was split into. */
  documents: (KnowledgeDocument & { passages: string[] })[];
}
