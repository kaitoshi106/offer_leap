import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Spinner } from '../Spinner';

const VARIANT_CLASSES = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft/80',
  outline: 'border border-border-strong bg-surface text-fg hover:bg-surface-muted',
  ghost: 'text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-danger-fg hover:bg-danger-hover',
} as const;

const SIZE_CLASSES = {
  sm: 'h-8 gap-1.5 rounded-sm px-3 text-sm',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-12 gap-2 rounded-lg px-6 text-base',
  // min-w (not a fixed width) so a text label never overflows when size="icon" is misused.
  icon: 'h-10 min-w-10 rounded-md px-2',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets `aria-busy`. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * @description Returns the classes of a button so links can look like buttons without nesting interactive elements.
 * @param options - Variant, size and width.
 * @returns Class string.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: Pick<ButtonProps, 'variant' | 'size' | 'fullWidth'> = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && 'w-full',
  );
}

/**
 * @description Native `<button>` with design-system variants. Defaults to `type="button"` so it never submits a
 * form by accident.
 * @param props - {@link ButtonProps}
 */
export function Button({
  variant,
  size,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonClasses({ variant, size, fullWidth }),
        // Busy, not unavailable: show a wait cursor and keep the button readable.
        loading && 'disabled:cursor-wait disabled:opacity-80',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" label={null} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
