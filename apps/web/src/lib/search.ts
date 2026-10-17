/**
 * @description Folds text for forgiving search: lower-case, no diacritics, "đ" → "d". So "ha noi", "Hà Nội" and
 * "HA NOI" all match each other — users often type Vietnamese without accents.
 * @param value - Text to fold.
 * @returns Folded text.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}
