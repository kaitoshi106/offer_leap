'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

import { Icon, Input, type InputProps } from '../../atoms';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'clearable'> {
  /** Accessible name of the toggle when the password is hidden. Pass translated text. */
  showLabel: string;
  /** Accessible name of the toggle when the password is visible. */
  hideLabel: string;
}

/**
 * @description Password field with a show/hide toggle (`aria-pressed`). The toggle keeps focus on the input so
 * typing can continue; browsers' password managers still recognise the field.
 * @param props - {@link PasswordInputProps}
 */
export function PasswordInput({ showLabel, hideLabel, className, size = 'md', ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;

  return (
    <span className="relative block w-full">
      <Input {...rest} size={size} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-1 my-auto inline-flex size-8 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size="sm" />
      </button>
    </span>
  );
}
