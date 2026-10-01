export const APP_NAME = 'OfferLeap';
export const APP_TAGLINE = 'Make the Leap. Land the Offer.';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';

/**
 * @description Narrows an arbitrary string (URL segment, cookie, header) to a supported locale.
 * @param value - Raw value to check.
 * @returns `true` when `value` is one of {@link LOCALES}.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
