'use client';

import { type ComponentPropsWithRef, useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';
import { mergeRefs } from '@/lib/merge-refs';

import { Icon } from '../Icon';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  /** Mixed state, e.g. "select all" when only some rows are selected. */
  indeterminate?: boolean;
  invalid?: boolean;
}

/**
 * @description Native checkbox (keeps keyboard, form and screen-reader behaviour for free) with a custom look:
 * the real input is visually replaced but stays focusable and clickable on top of the drawn box.
 * @param props - {@link CheckboxProps}
 */
export function Checkbox({ indeterminate = false, invalid = false, className, ref, ...rest }: CheckboxProps) {
  const innerRef = useRef<HTMLInputElement>(null);

  // `indeterminate` exists only as a DOM property, not as an HTML attribute.
  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={cn('relative inline-flex size-5 shrink-0', className)}>
      <input
        ref={mergeRefs(innerRef, ref)}
        type="checkbox"
        aria-invalid={invalid || undefined}
        className={cn(
          'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface',
          'transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        )}
        {...rest}
      />
      <Icon
        name="check"
        size="sm"
        className="pointer-events-none absolute inset-0.5 hidden text-primary-fg peer-checked:block peer-indeterminate:hidden"
      />
      <Icon
        name="minus"
        size="sm"
        className="pointer-events-none absolute inset-0.5 hidden text-primary-fg peer-indeterminate:block"
      />
    </span>
  );
}
