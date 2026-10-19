'use client';

import { type ChangeEvent, type DragEvent, type ReactNode, useId, useState } from 'react';

import { cn } from '@/lib/cn';

import { Icon, Text } from '../../atoms';

export type FileRejection = 'type' | 'size';

export interface FileDropzoneProps {
  /** Main line, e.g. "Drag your CV here or click to choose a file". */
  title: ReactNode;
  /** Accepted formats and size, shown under the title. */
  hint?: ReactNode;
  /** MIME types and/or extensions (`application/pdf`, `.docx`). Also passed to the native picker. */
  accept: readonly string[];
  maxBytes: number;
  /** Called with a file that passed the type and size checks. */
  onFile: (file: File) => void;
  /** Called when a picked or dropped file fails a check. The server checks again — this is only fast feedback. */
  onReject?: (reason: FileRejection, file: File) => void;
  /** Translated error shown under the zone (marks the input invalid). */
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * @description Whether a file matches one of the accepted MIME types or extensions. Browsers sometimes report an
 * empty type (e.g. DOCX on some systems), so the extension is checked too.
 * @param file - Picked or dropped file.
 * @param accept - Accepted MIME types/extensions.
 */
export function isAcceptedFile(file: File, accept: readonly string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((entry) =>
    entry.startsWith('.') ? name.endsWith(entry.toLowerCase()) : file.type === entry,
  );
}

/**
 * @description Drop area for a single file that is also a regular file input: a visually hidden
 * `<input type="file">` inside a `<label>`, so clicking, keyboard (Tab + Enter/Space) and screen readers work
 * without custom handling. Dragging a file over it highlights the zone.
 * @param props - {@link FileDropzoneProps}
 */
export function FileDropzone({
  title,
  hint,
  accept,
  maxBytes,
  onFile,
  onReject,
  error,
  disabled,
  className,
}: FileDropzoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  function handle(file: File | undefined) {
    if (!file || disabled) return;
    if (!isAcceptedFile(file, accept)) onReject?.('type', file);
    else if (file.size > maxBytes) onReject?.('size', file);
    else onFile(file);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    handle(event.target.files?.[0]);
    // Reset so choosing the same file again still fires `change`.
    event.target.value = '';
  }

  function onDragOver(event: DragEvent) {
    // Required, or the browser opens the dropped file instead of firing `drop`.
    event.preventDefault();
    if (!disabled) setDragging(true);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    handle(event.dataTransfer.files[0]);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-surface-muted/50 px-6 py-10 text-center transition-colors',
          'hover:border-primary hover:bg-primary-soft/40 data-dragging:border-primary data-dragging:bg-primary-soft/60',
          'has-focus-visible:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/30',
          error && 'border-danger',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
          <Icon name="upload" size="lg" />
        </span>
        <span className="font-medium text-fg">{title}</span>
        {hint && (
          <Text as="span" id={hintId} size="sm" tone="muted">
            {hint}
          </Text>
        )}
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={accept.join(',')}
          disabled={disabled}
          onChange={onChange}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
        />
      </label>
      {error && (
        <Text as="span" id={errorId} size="xs" tone="danger" className="flex items-center gap-1" role="alert">
          <Icon name="alert-circle" size="xs" />
          {error}
        </Text>
      )}
    </div>
  );
}
