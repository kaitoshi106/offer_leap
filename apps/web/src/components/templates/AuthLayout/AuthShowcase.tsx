import { Icon } from '../../atoms';

export interface AuthShowcaseCopy {
  /** e.g. "Match with the job description". */
  matchLabel: string;
  /** e.g. "AI filled in your profile". */
  aiLabel: string;
  skills: string[];
}

const MATCH_SCORE = 92;

/**
 * @description Decorative product preview for the brand panel: drifting light blobs and floating "glass" cards
 * (match score, AI badge, skills). Hidden from assistive tech; animations only run with `motion-safe`.
 * @param props.copy - Translated card text.
 */
export function AuthShowcase({ copy }: { copy: AuthShowcaseCopy }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {/* Light blobs drifting behind everything. */}
      <span className="absolute -top-24 -left-20 size-80 rounded-full bg-brand-fg/10 blur-3xl will-change-transform motion-safe:animate-blob" />
      <span className="absolute top-1/3 -right-28 size-96 rounded-full bg-brand-fg/10 blur-3xl will-change-transform motion-safe:animate-blob motion-safe:[animation-delay:-8s]" />
      <span className="absolute -bottom-32 left-1/4 size-72 rounded-full bg-brand-fg/5 blur-3xl will-change-transform motion-safe:animate-blob motion-safe:[animation-delay:-15s]" />

      {/* Floating cards, centred in the panel's free space. */}
      <div className="absolute inset-x-12 top-1/2 flex -translate-y-1/2 flex-col items-start gap-4">
        <div className="w-72 rounded-2xl border border-brand-fg/15 bg-brand-fg/10 p-5 shadow-popover backdrop-blur-md motion-safe:animate-float">
          <div className="flex items-center justify-between text-sm text-brand-fg-muted">
            <span className="flex items-center gap-2">
              <Icon name="target" size="sm" />
              {copy.matchLabel}
            </span>
            <span className="text-2xl font-bold text-brand-fg">{MATCH_SCORE}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-fg/15">
            <div
              className="h-full origin-left rounded-full bg-brand-fg motion-safe:animate-fill"
              style={{ width: `${MATCH_SCORE}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-brand-fg/15 px-2.5 py-0.5 text-xs font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="ml-16 inline-flex items-center gap-2 rounded-full border border-brand-fg/15 bg-brand-fg/10 px-4 py-2 text-sm font-medium shadow-popover backdrop-blur-md motion-safe:animate-float motion-safe:[animation-delay:-3.5s]">
          <Icon name="sparkles" size="sm" />
          {copy.aiLabel}
        </div>
      </div>
    </div>
  );
}
