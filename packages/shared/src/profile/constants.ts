export const CareerLevel = {
  INTERN: 'INTERN',
  FRESHER: 'FRESHER',
  JUNIOR: 'JUNIOR',
  MIDDLE: 'MIDDLE',
  SENIOR: 'SENIOR',
  LEAD: 'LEAD',
  MANAGER: 'MANAGER',
} as const;
export type CareerLevel = (typeof CareerLevel)[keyof typeof CareerLevel];
export const CAREER_LEVELS = Object.values(CareerLevel);

export const WorkType = {
  ONSITE: 'ONSITE',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
} as const;
export type WorkType = (typeof WorkType)[keyof typeof WorkType];
export const WORK_TYPES = Object.values(WorkType);

/** Wizard steps in order. `resume` (optional CV upload that pre-fills the next steps) comes first. */
export const ONBOARDING_STEPS = ['resume', 'personal', 'career', 'preferences', 'review'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const PROFILE_LIMITS = {
  skillsMax: 20,
  skillLength: 40,
  yearsMax: 50,
  /** Expected salary in million VND per month. */
  salaryMax: 1000,
} as const;
