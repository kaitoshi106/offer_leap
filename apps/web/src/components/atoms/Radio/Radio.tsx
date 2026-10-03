import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

export interface RadioProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  invalid?: boolean;
}

/**
 * @description Native radio input with a custom look. Group radios with the same `name`; the browser handles
 * arrow-key navigation inside the group.
 * @param props - {@link RadioProps}
 */
export function Radio({ invalid = false, className, ...rest }: RadioProps) {
  return (
    <span className={cn('relative inline-flex size-5 shrink-0', className)}>
      <input
        type="radio"
        aria-invalid={invalid || undefined}
        className={cn(
          'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface',
          'transition-colors checked:border-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        )}
        {...rest}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[5px] hidden rounded-full bg-primary peer-checked:block"
      />
    </span>
  );
}
