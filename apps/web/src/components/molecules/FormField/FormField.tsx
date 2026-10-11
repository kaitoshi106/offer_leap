'use client';

import { type ReactNode, useId } from 'react';

import { cn } from '@/lib/cn';

import { Icon, Label, Text } from '../../atoms';

/** Props to spread on the control so label, hint and error are wired for assistive tech. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FormFieldProps {
  label: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Translated error message; when set the control is marked invalid and the message is announced. */
  error?: string;
  required?: boolean;
  /** Use your own id (e.g. to target the input from elsewhere); generated otherwise. */
  id?: string;
  className?: string;
  /** Render prop receiving the props to spread on the input. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * @description Label + control + hint + error with the ARIA wiring done once: `htmlFor`/`id`, `aria-describedby`
 * pointing to hint and error, `aria-invalid` when there is an error.
 * @param props - {@link FormFieldProps}
 */
export function FormField({ label, hint, error, required, id, className, children }: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId} required={required}>
        {label}
      </Label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        ...(error && { 'aria-invalid': true as const }),
        ...(required && { required }),
      })}
      {hint && !error && (
        <Text as="span" id={hintId} size="xs" tone="muted">
          {hint}
        </Text>
      )}
      {error && (
        <Text as="span" id={errorId} size="xs" tone="danger" className="flex items-center gap-1" role="alert">
          <Icon name="alert-circle" size="xs" />
          {error}
        </Text>
      )}
    </div>
  );
}
