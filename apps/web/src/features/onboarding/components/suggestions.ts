import type { ProfileValues, ResumeSuggestions, ResumeSummary } from '@offerleap/shared';

export type SuggestedField = Exclude<keyof ResumeSuggestions, 'uncertainFields'>;
/** `check` = the AI marked the value as a guess. */
export type SuggestionState = 'suggested' | 'check';
export type SuggestedFields = Partial<Record<SuggestedField, SuggestionState>>;

const FIELDS: SuggestedField[] = [
  'fullName',
  'phone',
  'provinceCode',
  'industryCode',
  'jobTitle',
  'level',
  'yearsOfExperience',
  'skills',
];

const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((item, i) => item === b[i])
    : a === b;

/**
 * @description Which saved fields hold the value read from the latest CV. The API writes those values into the
 * draft when parsing finishes (replacing what was there), so a field only stays marked until the user changes it.
 * @param values - Saved draft.
 * @param resume - Latest CV (only a COMPLETED one has suggestions).
 */
export function suggestedFields(values: ProfileValues, resume: ResumeSummary | null): SuggestedFields {
  const suggestions = resume?.status === 'COMPLETED' ? resume.suggestions : null;
  if (!suggestions) return {};

  const suggested: SuggestedFields = {};
  for (const field of FIELDS) {
    const suggestion = suggestions[field];
    const empty = suggestion === null || (Array.isArray(suggestion) && suggestion.length === 0);
    if (!empty && sameValue(values[field], suggestion)) {
      suggested[field] = suggestions.uncertainFields.includes(field) ? 'check' : 'suggested';
    }
  }
  return suggested;
}
