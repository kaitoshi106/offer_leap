import type { ResumeSummary } from '../resume/types';
import type { CareerLevel, OnboardingStep, WorkType } from './constants';

export interface TaxonomyItem {
  code: string;
  nameVi: string;
  nameEn: string;
}

export interface ProvinceItem extends TaxonomyItem {
  type: 'CITY' | 'PROVINCE';
}

/** Profile fields as stored; anything not filled yet is `null` (or an empty list). */
export interface ProfileValues {
  fullName: string;
  phone: string | null;
  provinceCode: string | null;
  industryCode: string | null;
  jobTitle: string | null;
  level: CareerLevel | null;
  yearsOfExperience: number | null;
  skills: string[];
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  workTypes: WorkType[];
}

/** `GET /onboarding`: the saved draft and where to resume. */
export interface OnboardingState {
  step: OnboardingStep;
  completed: boolean;
  values: ProfileValues;
  /** The latest uploaded CV, if any, with the AI's suggestions once parsed. */
  resume: ResumeSummary | null;
}
