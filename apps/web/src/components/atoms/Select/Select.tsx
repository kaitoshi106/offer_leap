import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { Icon } from '../Icon';
import { fieldClasses } from '../Input';

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size'> {
  invalid?: boolean;
  /** Text of the empty first option (e.g. "Choose a level"). Omit to start on the first real option. */
  placeholder?: string;
}

/**
 * @description Native `<select>` styled like `Input`. Native keeps full keyboard, screen-reader and mobile picker
 * support; use `Combobox` when the list is long enough to need search.
 * @param props - {@link SelectProps}
 */
export function Select({ invalid = false, placeholder, className, children, ...rest }: SelectProps) {
  return (
    <span className="relative block w-full">
      <select
        aria-invalid={invalid || undefined}
        className={cn(fieldClasses, 'h-10 cursor-pointer appearance-none px-3 pr-10 text-sm', className)}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <Icon
        name="chevron-down"
        size="sm"
        className="pointer-events-none absolute inset-y-0 right-3 my-auto text-fg-subtle"
      />
    </span>
  );
}
