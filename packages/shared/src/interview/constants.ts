export const InterviewType = {
  BEHAVIORAL: 'BEHAVIORAL',
  TECHNICAL: 'TECHNICAL',
  MIXED: 'MIXED',
} as const;
export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];
export const INTERVIEW_TYPES = Object.values(InterviewType);

export const InterviewStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type InterviewStatus = (typeof InterviewStatus)[keyof typeof InterviewStatus];

export const INTERVIEW_LIMITS = {
  questionsMin: 3,
  questionsMax: 10,
  questionsDefault: 5,
  answerMax: 4_000,
  jobTitle: 160,
  /** Score of one answer. */
  answerScoreMax: 10,
} as const;
