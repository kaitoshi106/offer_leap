import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

const SIZE_CLASSES = {
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[3px]',
} as const;

export interface SpinnerProps extends ComponentPropsWithRef<'span'> {
  size?: keyof typeof SIZE_CLASSES;
  /** Announced to screen readers. Pass `null` when a parent already announces the loading state. */
  label?: string | null;
}

/**
 * @description Loading indicator. Exposes `role="status"` with a visually hidden label unless `label` is `null`.
 * @param props - {@link SpinnerProps}
 */
export function Spinner({ size = 'md', label = 'Loading…', className, ...rest }: SpinnerProps) {
  const ringClasses = cn(
    'inline-block animate-spin rounded-full border-current border-r-transparent',
    SIZE_CLASSES[size],
  );

  if (label === null) {
    return <span aria-hidden className={cn(ringClasses, className)} {...rest} />;
  }

  return (
    <span role="status" className={cn('inline-flex', className)} {...rest}>
      <span aria-hidden className={ringClasses} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
