import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * @description Content for screen readers only (e.g. extra context for an icon button). Still in the DOM, unlike
 * `display: none`.
 * @param props - Native `<span>` props.
 */
export function VisuallyHidden({ className, ...rest }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('sr-only', className)} {...rest} />;
}
