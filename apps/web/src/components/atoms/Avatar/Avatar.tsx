'use client';

import { type ComponentPropsWithRef, useState } from 'react';

import { cn } from '@/lib/cn';

const SIZE_CLASSES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

export interface AvatarProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  /** Person's name: used for the image alt text and the initials fallback. */
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE_CLASSES;
}

/**
 * @description Up to two initials from a name, e.g. "Trần Minh" → "TM".
 * @param name - Full name.
 * @returns Uppercase initials.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * @description User picture with an initials fallback when there is no image or it fails to load.
 * @param props - {@link AvatarProps}
 */
export function Avatar({ name, src, size = 'md', className, ...rest }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-soft-fg',
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {showImage ? (
        // Remote avatars come from arbitrary hosts; next/image would need every host whitelisted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span role="img" aria-label={name}>
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
