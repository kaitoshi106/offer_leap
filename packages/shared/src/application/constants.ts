/** Kanban columns, in board order. */
export const ApplicationStatus = {
  SAVED: 'SAVED',
  APPLIED: 'APPLIED',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  REJECTED: 'REJECTED',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
export const APPLICATION_STATUSES = Object.values(ApplicationStatus);

export const APPLICATION_LIMITS = {
  company: 120,
  jobTitle: 160,
  jobUrl: 500,
  notes: 5_000,
  coverLetter: 10_000,
} as const;
