'use client';

import { type ComponentPropsWithRef, type KeyboardEvent, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { mergeRefs } from '@/lib/merge-refs';

import { Icon } from '../Icon';

const SIZE_CLASSES = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
} as const;

/** Right padding that leaves room for the clear button. */
const CLEARABLE_PADDING = { sm: 'pr-8', md: 'pr-9', lg: 'pr-11' } as const;

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: keyof typeof SIZE_CLASSES;
  /** Marks the field invalid (`aria-invalid`) and switches to the danger border. */
  invalid?: boolean;
  /** Shows a ✕ button (and enables Escape) that clears the value while it is not empty. */
  clearable?: boolean;
  /** Accessible name of the clear button. Pass a translated string. */
  clearLabel?: string;
  /** Called after the value has been cleared. */
  onClear?: () => void;
}

/**
 * @description Shared styles for text-like controls so Input and Textarea stay visually identical.
 */
export const fieldClasses = cn(
  'w-full rounded-md border border-border-strong bg-surface text-fg placeholder:text-fg-subtle',
  'transition-colors outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
  // Read-only (e.g. filled from a chosen record): shown as a value, so nobody tries to type into it.
  '[&[readonly]]:cursor-default [&[readonly]]:bg-surface-muted [&[readonly]]:text-fg-muted [&[readonly]]:focus-visible:border-border-strong',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30',
);

/**
 * @description Sets an input's value the way the browser would, so React (and form libraries listening to
 * `onChange`) see a regular user edit. Assigning `input.value` directly would bypass React's change tracking.
 * @param input - Target input.
 * @param value - New value.
 */
function setValueAsUser(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * @description Native `<input>` with design-system styling and an optional clear button. Works controlled
 * (`value` + `onChange`) and uncontrolled (`defaultValue`). Pair it with `Label` via `id`/`htmlFor`.
 * @param props - {@link InputProps}
 */
export function Input({
  size = 'md',
  invalid = false,
  clearable = false,
  clearLabel = 'Clear',
  onClear,
  className,
  ref,
  onChange,
  onKeyDown,
  ...rest
}: InputProps) {
  const innerRef = useRef<HTMLInputElement>(null);
  const isControlled = rest.value !== undefined;
  const [uncontrolledHasValue, setUncontrolledHasValue] = useState(
    () => String(rest.defaultValue ?? '') !== '',
  );
  const hasValue = isControlled ? String(rest.value ?? '') !== '' : uncontrolledHasValue;
  const canClear = clearable && hasValue && !rest.disabled && !rest.readOnly;

  function clear() {
    const input = innerRef.current;
    if (!input) return;
    setValueAsUser(input, '');
    input.focus();
    onClear?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (!event.defaultPrevented && event.key === 'Escape' && canClear) {
      event.preventDefault();
      clear();
    }
  }

  const input = (
    <input
      ref={mergeRefs(innerRef, ref)}
      aria-invalid={invalid || undefined}
      className={cn(fieldClasses, SIZE_CLASSES[size], clearable && CLEARABLE_PADDING[size], className)}
      onChange={(event) => {
        if (!isControlled) setUncontrolledHasValue(event.target.value !== '');
        onChange?.(event);
      }}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );

  if (!clearable) return input;

  return (
    <span className="relative block w-full">
      {input}
      {canClear && (
        <button
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          onClick={clear}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-7 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <Icon name="x" size="sm" />
        </button>
      )}
    </span>
  );
}
