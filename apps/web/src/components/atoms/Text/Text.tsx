import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

const SIZE_CLASSES = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const;

const TONE_CLASSES = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  primary: 'text-primary',
  success: 'text-success',
  danger: 'text-danger',
} as const;

const WEIGHT_CLASSES = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const;

export interface TextProps extends ComponentPropsWithRef<'p'> {
  as?: 'p' | 'span' | 'div';
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
  weight?: keyof typeof WEIGHT_CLASSES;
}

/**
 * @description Body text with size, tone and weight from the design scale.
 * @param props - {@link TextProps}
 */
export function Text({
  as: Tag = 'p',
  size = 'md',
  tone = 'default',
  weight = 'regular',
  className,
  ...rest
}: TextProps) {
  return (
    <Tag
      className={cn(SIZE_CLASSES[size], TONE_CLASSES[tone], WEIGHT_CLASSES[weight], className)}
      {...rest}
    />
  );
}
