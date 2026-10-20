import type { Locale } from '@offerleap/shared';

/** Language name for "write in …" instructions. */
export const LANGUAGE: Record<Locale, string> = { vi: 'Vietnamese', en: 'English' };

/** `2026-10-20` — the date part of an ISO timestamp. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * @description Line every prompt includes: without it the model treats its training cutoff as "now" and gets
 * durations like "2019 – present" wrong.
 * @param today - Current date.
 */
export const todayLine = (today: Date) =>
  `Today's date is ${isoDate(today)}; "present"/"now"/"nay" in the documents means today.`;
