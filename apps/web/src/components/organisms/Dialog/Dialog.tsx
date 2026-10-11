'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/cn';

import { Button, Heading, Icon, Text } from '../../atoms';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, the close button or a click on the backdrop. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Accessible name of the close (×) button. Pass translated text. */
  closeLabel: string;
  children?: ReactNode;
  /** Actions row, e.g. Cancel / Confirm buttons. */
  footer?: ReactNode;
  className?: string;
}

/**
 * @description Modal dialog built on the native `<dialog>` element: `showModal()` puts it in the top layer, makes
 * the rest of the page inert (focus can't leave), closes on Escape and returns focus to the opener — the hard
 * parts of the WAI-ARIA dialog pattern come from the browser.
 * @param props - {@link DialogProps}
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Keep React in control of `open`: block the browser's own close and ask the parent.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicks on the ::backdrop target the <dialog> itself; clicks inside hit its children.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-fg shadow-popover',
        'backdrop:bg-overlay',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Heading level={2} size="sm" id={titleId}>
              {title}
            </Heading>
            {description && (
              <Text id={descriptionId} size="sm" tone="muted">
                {description}
              </Text>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={closeLabel}
            onClick={onClose}
            className="-mt-2 -mr-2"
          >
            <Icon name="x" />
          </Button>
        </div>
        {children}
        {footer && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}
