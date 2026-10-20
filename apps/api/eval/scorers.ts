/**
 * Expectations for one field of a model answer. Plain values must match exactly; the object forms allow the
 * judgement calls a model can reasonably make (e.g. JUNIOR or MIDDLE for 2 years of experience).
 */
export type Expectation =
  | string
  | number
  | null
  | { oneOf: (string | number | null)[] }
  | { range: [number, number] }
  | { includes: string[] }
  | { excludes: string[] }
  | { not: string | number | null };

export interface FieldResult {
  field: string;
  pass: boolean;
  expected: Expectation;
  actual: unknown;
}

const norm = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @description Whether a list answer names an item. `item` may list spellings separated by `|` ("Go|Golang"); an
 * entry matches when it contains one of them as a whole word ("Go (Golang)" matches "Go"; "Google Ads" doesn't).
 * List entries may be strings or objects with a `name` (missing skills).
 */
function listHas(list: unknown, item: string): boolean {
  if (!Array.isArray(list)) return false;
  const entries = list.map((entry) =>
    String(norm(typeof entry === 'object' && entry ? (entry as { name: unknown }).name : entry)),
  );
  return item
    .toLowerCase()
    .split('|')
    .some((spelling) => {
      const word = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(spelling)}($|[^\\p{L}\\p{N}])`, 'u');
      return entries.some((entry) => word.test(entry));
    });
}

/**
 * @description Checks one value against its expectation. Strings compare case- and space-insensitively; list
 * checks look for items by name, ignoring case.
 * @param expected - What the dataset expects.
 * @param actual - What the model answered.
 */
export function matches(expected: Expectation, actual: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return norm(expected) === norm(actual);
  if ('oneOf' in expected) return expected.oneOf.some((option) => norm(option) === norm(actual));
  if ('range' in expected) {
    return typeof actual === 'number' && actual >= expected.range[0] && actual <= expected.range[1];
  }
  if ('includes' in expected) return expected.includes.every((item) => listHas(actual, item));
  if ('excludes' in expected) return expected.excludes.every((item) => !listHas(actual, item));
  return norm(expected.not) !== norm(actual);
}

/**
 * @description Scores every expected field of one answer.
 * @param expected - Field → expectation. Fields not listed are not scored.
 * @param answer - The model's (post-processed) answer.
 */
export function scoreFields(
  expected: Record<string, Expectation>,
  answer: Record<string, unknown>,
): FieldResult[] {
  return Object.entries(expected).map(([field, expectation]) => ({
    field,
    pass: matches(expectation, answer[field]),
    expected: expectation,
    actual: answer[field],
  }));
}

/**
 * @description Nearest-rank percentile (p50, p95) of latencies.
 * @param values - Samples.
 * @param percentile - 0–100.
 */
export function percentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

/** Whether a text is written in Vietnamese (contains letters with Vietnamese diacritics). */
export const looksVietnamese = (text: string) =>
  /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text);
