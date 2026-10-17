'use client';

import { type ClipboardEvent, type ComponentPropsWithRef, type KeyboardEvent, useState } from 'react';

import { cn } from '@/lib/cn';

import { Icon } from '../../atoms';

export interface TagInputProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size'
> {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Accessible name of each tag's remove button, e.g. `(tag) => t('remove', { tag })`. */
  removeLabel: (tag: string) => string;
  maxTags?: number;
  invalid?: boolean;
}

/**
 * @description Free-text list input (skills, keywords). Enter or comma adds the typed text, pasting
 * "a, b, c" adds several, Backspace on an empty input removes the last tag. Duplicates (case-insensitive) and
 * empty entries are ignored. The pending text is also added when the field loses focus.
 * @param props - {@link TagInputProps}
 */
export function TagInput({
  value,
  onChange,
  removeLabel,
  maxTags = Infinity,
  invalid = false,
  className,
  onBlur,
  onKeyDown,
  disabled,
  ...rest
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  function add(texts: string[]) {
    const next = [...value];
    for (const text of texts.map((item) => item.trim())) {
      if (!text || next.length >= maxTags) continue;
      if (next.some((tag) => tag.toLowerCase() === text.toLowerCase())) continue;
      next.push(text);
    }
    if (next.length !== value.length) onChange(next);
    setDraft('');
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' || event.key === ',') {
      // Enter would otherwise submit the form.
      event.preventDefault();
      add([draft]);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value.length - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!/[,\n]/.test(text)) return;
    event.preventDefault();
    add(text.split(/[,\n]/));
  }

  return (
    <div
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm transition-colors',
        'focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/30',
        invalid && 'border-danger focus-within:ring-danger/30',
        disabled && 'cursor-not-allowed bg-surface-muted opacity-60',
        className,
      )}
    >
      <ul className="contents">
        {value.map((tag, index) => (
          <li
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary-soft-fg"
          >
            {tag}
            <button
              type="button"
              aria-label={removeLabel(tag)}
              disabled={disabled}
              onClick={() => remove(index)}
              className="inline-flex size-4 items-center justify-center rounded-full hover:bg-primary-soft-fg/15"
            >
              <Icon name="x" size="xs" />
            </button>
          </li>
        ))}
      </ul>
      <input
        {...rest}
        type="text"
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        disabled={disabled || value.length >= maxTags}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={(event) => {
          add([draft]);
          onBlur?.(event);
        }}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-fg outline-none placeholder:text-fg-subtle"
      />
    </div>
  );
}
