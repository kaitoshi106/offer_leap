import type { Locale, TaxonomyItem } from '@offerleap/shared';

import type { ComboboxOption } from '@/components/organisms';

/**
 * @description Taxonomy rows as combobox options labelled in the UI language; the other language's name is kept
 * as a search keyword ("Hanoi" finds "Hà Nội").
 * @param items - Industries or provinces.
 * @param locale - UI language.
 */
export function toOptions(items: TaxonomyItem[] | undefined, locale: Locale): ComboboxOption[] {
  return (items ?? []).map((item) => ({
    value: item.code,
    label: locale === 'vi' ? item.nameVi : item.nameEn,
    keywords: locale === 'vi' ? item.nameEn : item.nameVi,
  }));
}

/** Which wizard step owns each field, to jump back to the right step when finishing fails. */
export const FIELD_STEP: Record<string, 'personal' | 'career' | 'preferences'> = {
  fullName: 'personal',
  phone: 'personal',
  provinceCode: 'personal',
  industryCode: 'career',
  jobTitle: 'career',
  level: 'career',
  yearsOfExperience: 'career',
  skills: 'career',
  expectedSalaryMin: 'preferences',
  expectedSalaryMax: 'preferences',
  workTypes: 'preferences',
};
