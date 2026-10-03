import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

export interface LabelProps extends ComponentPropsWithRef<'label'> {
  /** Shows a visual marker. The control itself must carry `required` so assistive tech announces it. */
  required?: boolean;
}

/**
 * @description Form label. Associate it with a control through `htmlFor`.
 * @param props - {@link LabelProps}
 */
export function Label({ required = false, className, children, ...rest }: LabelProps) {
  return (
    <label className={cn('inline-flex items-center gap-1 text-sm font-medium text-fg', className)} {...rest}>
      {children}
      {required && (
        <span aria-hidden className="text-danger">
          *
        </span>
      )}
    </label>
  );
}
