import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { fieldClasses } from '../Input';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
}

/**
 * @description Native `<textarea>` styled like `Input`; grows with content where `field-sizing` is supported.
 * @param props - {@link TextareaProps}
 */
export function Textarea({ invalid = false, rows = 4, className, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldClasses, 'field-sizing-content min-h-20 px-3 py-2 text-sm', className)}
      {...rest}
    />
  );
}
