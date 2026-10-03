import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

const SIZE_CLASSES = {
  xs: 'text-base font-semibold',
  sm: 'text-lg font-semibold',
  md: 'text-xl font-semibold tracking-tight',
  lg: 'text-2xl font-bold tracking-tight',
  xl: 'text-3xl font-bold tracking-tight',
  '2xl': 'text-4xl font-bold tracking-tight sm:text-5xl',
} as const;

const DEFAULT_SIZE_BY_LEVEL = { 1: '2xl', 2: 'xl', 3: 'lg', 4: 'md', 5: 'sm', 6: 'xs' } as const;

export interface HeadingProps extends ComponentPropsWithRef<'h1'> {
  /** Document outline level (`h1`–`h6`). */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Visual size, independent from the level so the outline stays correct. */
  size?: keyof typeof SIZE_CLASSES;
}

/**
 * @description Heading whose semantic level and visual size are decoupled.
 * @param props - {@link HeadingProps}
 */
export function Heading({ level, size, className, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      className={cn('text-balance text-fg', SIZE_CLASSES[size ?? DEFAULT_SIZE_BY_LEVEL[level]], className)}
      {...rest}
    />
  );
}
