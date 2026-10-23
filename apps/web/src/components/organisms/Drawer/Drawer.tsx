'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

import { Button, Icon } from '../../atoms';

export interface DrawerProps {
  open: boolean;
  /** Called on Escape, the close button, a click on the backdrop or on a link inside (it navigates away). */
  onClose: () => void;
  /** Accessible name of the drawer, e.g. "Menu". Pass translated text. */
  label: string;
  /** Accessible name of the close (×) button. Pass translated text. */
  closeLabel: string;
  /** Top-left of the drawer, next to the close button (e.g. the brand). */
  header?: ReactNode;
  children: ReactNode;
  /** Pinned to the bottom (e.g. the account and sign-out). */
  footer?: ReactNode;
  /** Edge it slides in from. */
  side?: 'left' | 'right';
  /** Appear without the slide-in (e.g. reopened after a reload, where it was already open). */
  instant?: boolean;
  /** Selector of the element to focus on opening, instead of the first focusable one. */
  initialFocus?: string;
  /**
   * Called once the drawer is fully closed (after the slide-out). The browser returns focus to the element that
   * opened it; when it was opened from code (no such element), use this to place focus.
   */
  onAfterClose?: () => void;
}

/** Longest exit animation (ms), so the dialog still closes if `animationend` never fires. */
const EXIT_MS = 250;

/**
 * @description Stops the page behind from scrolling. Hiding the scrollbar would widen the page (and move it
 * sideways) on systems with classic scrollbars, so its width is added back as padding.
 * @returns A function that restores the page.
 */
function lockPageScroll(): () => void {
  const root = document.documentElement;
  const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
  const scrollbar = root.clientWidth > 0 ? window.innerWidth - root.clientWidth : 0;
  root.style.overflow = 'hidden';
  if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
  return () => {
    root.style.overflow = previous.overflow;
    root.style.paddingRight = previous.paddingRight;
  };
}

/**
 * @description Side sheet that slides in from an edge — the navigation menu on phones. Built on a modal
 * `<dialog>` like `Dialog`: the page behind is inert, focus stays inside, Escape closes it and focus returns to
 * the button that opened it. The page behind doesn't scroll while it is shown (until the slide-out is over), and
 * doesn't shift sideways when its scrollbar goes away. Closing plays the slide-out first (`data-closing`), then
 * closes the dialog; with reduced motion it closes at once.
 * @param props - {@link DrawerProps}
 */
export function Drawer({
  open,
  onClose,
  label,
  closeLabel,
  header,
  children,
  footer,
  side = 'left',
  instant = false,
  initialFocus,
  onAfterClose,
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** Restores page scrolling; set while the dialog is shown (including its slide-out). */
  const unlockPage = useRef<(() => void) | null>(null);

  // Layout effects: the dialog opens (or is reopened after a language switch) before the browser paints.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const closeNow = () => {
      delete dialog.dataset.closing;
      dialog.close();
      unlockPage.current?.();
      unlockPage.current = null;
      onAfterClose?.();
    };
    if (open) {
      delete dialog.dataset.closing;
      if (!dialog.open) {
        dialog.showModal();
        unlockPage.current ??= lockPageScroll();
        // showModal() focuses the first focusable element; move on to the requested one if any.
        if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
      }
      return;
    }
    if (!dialog.open) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeNow();
      return;
    }
    dialog.dataset.closing = '';
    // The slide-out and the backdrop fade both end on the dialog, and the fallback timer may fire as well: the
    // first one finishes, the others are ignored.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      dialog.removeEventListener('animationend', onEnd);
      clearTimeout(fallback);
      closeNow();
    };
    const onEnd = (event: AnimationEvent) => event.target === dialog && finish();
    dialog.addEventListener('animationend', onEnd);
    const fallback = setTimeout(finish, EXIT_MS + 100);
    return () => {
      dialog.removeEventListener('animationend', onEnd);
      clearTimeout(fallback);
    };
    // Only `open` drives the dialog; `initialFocus` and `onAfterClose` are read when it opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Unmounted while open (e.g. navigating away): give the page its scrolling back.
  useLayoutEffect(
    () => () => {
      unlockPage.current?.();
      unlockPage.current = null;
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        // Keep React in control of `open`: block the browser's own close and ask the parent.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // The ::backdrop targets the <dialog> itself; a link inside navigates, so the menu should go away —
        // except links inside `[data-drawer-keep-open]` (settings such as the language switch).
        const target = event.target as HTMLElement;
        const link = target.closest('a[href]');
        if (target === event.currentTarget || (link && !link.closest('[data-drawer-keep-open]'))) onClose();
      }}
      className={cn(
        // Pinned to one edge at full height instead of the dialog's default centring.
        'm-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-border bg-surface p-0 text-fg shadow-popover',
        side === 'left'
          ? 'mr-auto border-r motion-safe:data-closing:animate-drawer-out-left'
          : 'ml-auto border-l motion-safe:data-closing:animate-drawer-out-right',
        !instant &&
          (side === 'left' ? 'motion-safe:animate-drawer-in-left' : 'motion-safe:animate-drawer-in-right'),
        !instant && 'motion-safe:backdrop:animate-fade-in',
        'backdrop:bg-overlay motion-safe:data-closing:backdrop:animate-fade-out',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          {header}
          <Button variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose} className="-mr-2">
            <Icon name="x" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">{children}</div>
        {footer && <div className="flex flex-col gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </dialog>
  );
}
