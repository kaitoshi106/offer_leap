/**
 * Names of validation rules. Schemas put the rule name in the Zod issue message; the API returns it in
 * `FieldError.rule` and the web app translates `validation.<rule>` with `FieldError.params`.
 */
export const ValidationRule = {
  REQUIRED: 'required',
  INVALID_EMAIL: 'invalidEmail',
  TOO_SHORT: 'tooShort',
  TOO_LONG: 'tooLong',
  WEAK_PASSWORD: 'weakPassword',
  PASSWORDS_MISMATCH: 'passwordsMismatch',
  /** A new password equal to the current one. */
  SAME_AS_CURRENT: 'sameAsCurrent',
  INVALID: 'invalid',
} as const;

export type ValidationRule = (typeof ValidationRule)[keyof typeof ValidationRule];

const RULES: ReadonlySet<string> = new Set(Object.values(ValidationRule));

/**
 * @description Narrows a Zod issue message to a known rule.
 * @param value - Issue message.
 * @returns `true` when `value` is a {@link ValidationRule}.
 */
export function isValidationRule(value: unknown): value is ValidationRule {
  return typeof value === 'string' && RULES.has(value);
}
