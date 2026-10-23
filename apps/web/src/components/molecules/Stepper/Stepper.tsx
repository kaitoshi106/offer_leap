import { cn } from '@/lib/cn';

import { Icon, VisuallyHidden } from '../../atoms';

export interface StepperProps {
  /** `skipped`: an optional step the user passed over (shown neutral, not as done). */
  steps: { key: string; label: string; skipped?: boolean }[];
  /** Index of the current step. */
  current: number;
  /** Announced before the list, e.g. "Onboarding progress". */
  label: string;
  /** Screen-reader suffix for finished steps, e.g. "(completed)". */
  completedLabel: string;
  /** Screen-reader suffix for skipped steps, e.g. "(skipped)". */
  skippedLabel?: string;
  /** Caption shown on phones, where the step names don't fit, e.g. "Step 2 of 5: Personal". */
  currentLabel?: string;
  className?: string;
}

/**
 * @description Progress indicator for multi-step flows: an ordered list where the current step has
 * `aria-current="step"` and finished steps carry a check mark plus hidden "completed" text (skipped ones a dash
 * and "skipped"). On phones only the numbers fit: the names stay for screen readers and a caption names the
 * current step.
 * @param props - {@link StepperProps}
 */
export function Stepper({
  steps,
  current,
  label,
  completedLabel,
  skippedLabel,
  currentLabel,
  className,
}: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const skipped = index < current && Boolean(step.skipped);
          const done = index < current && !skipped;
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
                  skipped && 'border-primary text-primary-text',
                  active && 'border-primary text-primary-text',
                  !done && !skipped && !active && 'border-border-strong text-fg-subtle',
                )}
              >
                {done ? <Icon name="check" size="xs" /> : skipped ? <span aria-hidden>–</span> : index + 1}
              </span>
              {/* Visually hidden on phones (only the numbers fit), still read out. */}
              <span
                className={cn(
                  'sr-only text-sm sm:not-sr-only',
                  active ? 'font-semibold text-fg' : 'text-fg-muted',
                )}
              >
                {step.label}
                {done && <VisuallyHidden> {completedLabel}</VisuallyHidden>}
                {skipped && skippedLabel && <VisuallyHidden> {skippedLabel}</VisuallyHidden>}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn('h-px flex-1', index < current ? 'bg-primary' : 'bg-border')}
                />
              )}
            </li>
          );
        })}
      </ol>
      {currentLabel && (
        // The list above already tells screen readers which step is current.
        <p aria-hidden className="mt-3 text-sm font-semibold text-fg sm:hidden">
          {currentLabel}
        </p>
      )}
    </nav>
  );
}
