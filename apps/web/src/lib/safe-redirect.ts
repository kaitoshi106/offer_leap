/**
 * @description Accepts only same-site, locale-less paths for `?next=` redirects, so a crafted link can't send
 * users to another site after signing in (open redirect).
 * @param value - Raw `next` query value.
 * @param fallback - Path used when `value` is missing or unsafe.
 * @returns A path starting with a single `/`.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
