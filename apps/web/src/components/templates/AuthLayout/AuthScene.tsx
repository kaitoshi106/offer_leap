import Image from 'next/image';

import { cn } from '@/lib/cn';

export interface AuthSceneCopy {
  /** The line set over the photo (the morning side on a split scene). */
  line: string;
  /** Split scene only: the line on the night side. */
  nightLine?: string;
  /** Short product facts floating in front of the photo (decorative). */
  chips: string[];
  /** Small print saying how the photos were made. */
  credit: string;
}

export interface AuthScenePhotos {
  morning: string;
  /** Needed for the split scene. */
  night?: string;
}

interface AuthSceneProps {
  copy: AuthSceneCopy;
  photos: AuthScenePhotos;
  /** `morning`: one photo. `split`: tonight on the left, tomorrow morning on the right, divided down the middle. */
  variant?: 'morning' | 'split';
  /** `panel`: the full-height side panel. `band`: the short strip shown above the form on small screens. */
  layout?: 'panel' | 'band';
}

/**
 * @description Photographic scene for the auth pages, built in planes: the photo (breathing slowly), a scrim, the
 * text, and product chips floating in front at their own pace. The photos are mood, not content, so they have empty
 * alt text; the chips are hidden from assistive tech. All motion is `motion-safe`.
 * @param props - {@link AuthSceneProps}
 */
export function AuthScene({ copy, photos, variant = 'morning', layout = 'panel' }: AuthSceneProps) {
  // A split scene needs both photos; without the night one it falls back to the morning scene.
  const night = variant === 'split' ? photos.night : undefined;
  const panel = layout === 'panel';

  return (
    <div className="absolute inset-0 overflow-hidden bg-night">
      {night ? (
        <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative overflow-hidden">
            <Image
              src={night}
              alt=""
              fill
              priority={panel}
              sizes="100vw"
              className="object-cover object-[45%_50%] motion-safe:animate-breathe"
            />
          </div>
          <div className="relative overflow-hidden">
            <Image
              src={photos.morning}
              alt=""
              fill
              priority={panel}
              sizes="100vw"
              className="object-cover object-[55%_40%] motion-safe:animate-breathe motion-safe:[animation-delay:-9s]"
            />
          </div>
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-px bg-night-fg/80" />
        </div>
      ) : (
        <Image
          src={photos.morning}
          alt=""
          fill
          priority={panel}
          sizes="100vw"
          className="object-cover object-[55%_38%] motion-safe:animate-breathe"
        />
      )}

      {/* Scrim under the text only: the top and bottom, where the brand and the line sit. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-night/70 via-transparent via-35% to-night/90"
      />

      {panel && (
        <div aria-hidden className="absolute inset-x-12 top-[18%] flex flex-col items-end gap-3">
          {copy.chips.map((chip, index) => (
            <span
              key={chip}
              className={cn(
                'rounded-xl bg-night-surface/90 px-4 py-2.5 text-sm font-semibold text-night-fg shadow-popover ring-1 ring-night-border motion-safe:animate-float',
                index % 2 === 1 && 'mr-16 motion-safe:[animation-delay:-3.5s]',
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col text-night-fg',
          panel ? 'gap-3 p-12' : 'gap-1 px-4 pb-3 sm:px-8',
        )}
      >
        {night ? (
          <div className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', panel ? 'gap-10' : 'gap-6')}>
            <p className={cn('font-bold text-balance', panel ? 'text-2xl' : 'text-sm')}>{copy.nightLine}</p>
            <p className={cn('font-bold text-balance', panel ? 'text-2xl' : 'text-sm')}>{copy.line}</p>
          </div>
        ) : (
          <p
            className={cn('max-w-md font-bold text-balance', panel ? 'text-3xl leading-tight' : 'text-base')}
          >
            {copy.line}
          </p>
        )}
        {panel && <p className="text-xs text-night-fg-muted">{copy.credit}</p>}
      </div>
    </div>
  );
}
