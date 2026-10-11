import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from '../../atoms';

const TONES = {
  info: { classes: 'border-info-soft-fg/20 bg-info-soft text-info-soft-fg', icon: 'info' },
  success: { classes: 'border-success-soft-fg/20 bg-success-soft text-success-soft-fg', icon: 'check' },
  warning: {
    classes: 'border-warning-soft-fg/20 bg-warning-soft text-warning-soft-fg',
    icon: 'alert-circle',
  },
  danger: { classes: 'border-danger-soft-fg/20 bg-danger-soft text-danger-soft-fg', icon: 'alert-circle' },
} satisfies Record<string, { classes: string; icon: IconName }>;

export interface AlertProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  tone?: keyof typeof TONES;
  title?: ReactNode;
}

/**
 * @description Inline message. `danger` uses `role="alert"` (announced immediately); other tones use
 * `role="status"` (announced politely).
 * @param props - {@link AlertProps}
 */
export function Alert({ tone = 'info', title, className, children, ...rest }: AlertProps) {
  const { classes, icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border p-3 text-sm', classes, className)}
      {...rest}
    >
      <Icon name={icon} size="sm" className="mt-0.5" />
      <div className="flex flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
