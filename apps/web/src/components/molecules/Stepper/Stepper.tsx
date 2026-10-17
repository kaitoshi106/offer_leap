import { cn } from '@/lib/cn';

import { Icon, VisuallyHidden } from '../../atoms';

export interface StepperProps {
  steps: { key: string; label: string }[];
  /** Index of the current step. */
  current: number;
  /** Announced before the list, e.g. "Onboarding progress". */
  label: string;
  /** Screen-reader suffix for finished steps, e.g. "(completed)". */
  completedLabel: string;
  className?: string;
}

/**
 * @description Progress indicator for multi-step flows: an ordered list where the current step has
 * `aria-current="step"` and finished steps carry a check mark plus hidden "completed" text.
 * @param props - {@link StepperProps}
 */
export function Stepper({ steps, current, label, completedLabel, className }: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step.key}
              aria-current={active ? 'step' : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  done && 'border-primary bg-primary text-primary-fg',
                  active && 'border-primary text-primary-text',
                  !done && !active && 'border-border-strong text-fg-subtle',
                )}
              >
                {done ? <Icon name="check" size="xs" /> : index + 1}
              </span>
              <span
                className={cn('hidden text-sm sm:inline', active ? 'font-semibold text-fg' : 'text-fg-muted')}
              >
                {step.label}
                {done && <VisuallyHidden> {completedLabel}</VisuallyHidden>}
              </span>
              {index < steps.length - 1 && (
                <span aria-hidden className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-border')} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
