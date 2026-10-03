import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * @description Placeholder block shown while content loads. Hidden from assistive tech; announce loading with a
 * `Spinner` or `aria-busy` on the container instead. Size it with `className`.
 * @param props - Native `<div>` props.
 */
export function Skeleton({ className, ...rest }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none', className)}
      {...rest}
    />
  );
}
