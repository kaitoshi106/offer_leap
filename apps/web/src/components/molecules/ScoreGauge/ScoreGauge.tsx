import { cn } from '@/lib/cn';

const TONES = {
  success: 'text-success',
  primary: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

const SIZES = {
  sm: { box: 'size-12', text: 'text-sm', stroke: 10 },
  lg: { box: 'size-32', text: 'text-3xl', stroke: 8 },
} as const;

export type ScoreTone = keyof typeof TONES;

export interface ScoreGaugeProps {
  /** 0–100. */
  score: number;
  /** Accessible name, e.g. "Match score". */
  label: string;
  /** Read out instead of the bare number, e.g. "72 out of 100, good match". */
  valueText: string;
  tone: ScoreTone;
  size?: keyof typeof SIZES;
  className?: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * @description Circular score from 0 to 100. Exposed as a `meter` so screen readers announce its name and
 * `valueText`; the ring and the number are decoration for sighted users. Colour is chosen by the caller and is
 * never the only signal (the number and usually a text label are shown too).
 * @param props - {@link ScoreGaugeProps}
 */
export function ScoreGauge({ score, label, valueText, tone, size = 'lg', className }: ScoreGaugeProps) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const { box, text, stroke } = SIZES[size];
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn('relative inline-flex shrink-0 items-center justify-center', box, TONES[tone], className)}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span aria-hidden className={cn('font-bold text-fg tabular-nums', text)}>
        {value}
      </span>
    </div>
  );
}
