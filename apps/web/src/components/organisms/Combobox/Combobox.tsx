'use client';

import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/cn';
import { foldForSearch } from '@/lib/search';

import { fieldClasses, Icon } from '../../atoms';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text that should match searches (e.g. an English name). */
  keywords?: string;
}

export interface ComboboxProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'role'
> {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown when the search matches nothing. Pass translated text. */
  noResultsLabel: string;
  invalid?: boolean;
}

/**
 * @description Searchable single select following the WAI-ARIA combobox pattern (list autocomplete): typing
 * filters options accent-insensitively, ↑/↓ move the active option (`aria-activedescendant`, focus stays in the
 * input), Enter picks it, Escape closes, Tab closes without changing the value. Clearing the text and leaving the
 * field clears the value.
 * @param props - {@link ComboboxProps}
 */
export function Combobox({
  options,
  value,
  onChange,
  noResultsLabel,
  invalid = false,
  className,
  onBlur,
  onKeyDown,
  disabled,
  ...rest
}: ComboboxProps) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  /** `null` while not typing: the input then shows the selected option's label. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    if (!query) return options;
    const needle = foldForSearch(query);
    return options.filter((option) =>
      foldForSearch(`${option.label} ${option.keywords ?? ''}`).includes(needle),
    );
  }, [options, query]);
  const active = open ? filtered[activeIndex] : undefined;
  const optionId = (index: number) => `${listId}-option-${index}`;

  // Keep the active option visible while moving with the keyboard.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  function openList() {
    setOpen(true);
    setActiveIndex(
      Math.max(
        0,
        filtered.findIndex((option) => option.value === value),
      ),
    );
  }

  function close() {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  }

  /** Leaving the field (Tab or blur): an erased text clears the value; otherwise the selection stays. */
  function commitAndClose() {
    if (query === '') onChange(null);
    close();
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        if (open && active) {
          // Picking an option must not submit the surrounding form.
          event.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case 'Tab':
        commitAndClose();
        break;
    }
  }

  return (
    <span className="relative block w-full">
      <input
        {...rest}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active ? optionId(activeIndex) : undefined}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        autoComplete="off"
        disabled={disabled}
        value={query ?? selected?.label ?? ''}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onClick={() => (open ? close() : openList())}
        onBlur={(event) => {
          commitAndClose();
          onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
        className={cn(fieldClasses, 'h-10 px-3 pr-10 text-sm', className)}
      />
      <Icon
        name="chevron-down"
        size="sm"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-3 my-auto text-fg-subtle transition-transform',
          open && 'rotate-180',
        )}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-popover"
      >
        {filtered.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-sm text-fg-muted">
            {noResultsLabel}
          </li>
        ) : (
          filtered.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              // mousedown would blur the input (and close the list) before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseMove={() => setActiveIndex(index)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm text-fg',
                index === activeIndex && 'bg-surface-muted',
              )}
            >
              {option.label}
              {option.value === value && <Icon name="check" size="sm" className="text-primary-text" />}
            </li>
          ))
        )}
      </ul>
    </span>
  );
}
