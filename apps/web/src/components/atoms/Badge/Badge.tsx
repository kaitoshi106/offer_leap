import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONE_CLASSES = {
  neutral: 'bg-surface-muted text-fg-muted',
  primary: 'bg-primary-soft text-primary-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
  danger: 'bg-danger-soft text-danger-soft-fg',
  info: 'bg-info-soft text-info-soft-fg',
  /** Marks AI-generated or AI-suggested content. */
  ai: 'bg-ai-soft text-ai-soft-fg',
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

/**
 * @description Small status label. Colour is never the only signal — always include text.
 * @param props - {@link BadgeProps}
 */
export function Badge({ tone = 'neutral', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
