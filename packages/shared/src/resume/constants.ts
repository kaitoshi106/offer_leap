/** Largest CV accepted (10 MB): plenty for a multi-page PDF or a phone photo. */
export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

/** Accepted CV formats. The API checks the file's bytes, not just its name or declared type. */
export const RESUME_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;
export type ResumeMimeType = keyof typeof RESUME_FILE_TYPES;

export const ResumeStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type ResumeStatus = (typeof ResumeStatus)[keyof typeof ResumeStatus];

/** Statuses after which the job won't change any more (stop polling). */
export const RESUME_FINAL_STATUSES: readonly ResumeStatus[] = [ResumeStatus.COMPLETED, ResumeStatus.FAILED];
