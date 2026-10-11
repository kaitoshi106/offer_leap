'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from '../../atoms';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. Default 5000; errors stay 8000 so they can be read. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'tone' | 'title'>> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { icon: IconName; classes: string }> = {
  info: { icon: 'info', classes: 'text-info-soft-fg' },
  success: { icon: 'check', classes: 'text-success' },
  danger: { icon: 'alert-circle', classes: 'text-danger' },
};

/**
 * @description Holds the toast queue and renders the live region. Toasts are announced politely
 * (`aria-live="polite"`), errors assertively, and each can be dismissed with its close button.
 * @param props.children - App subtree.
 * @param props.dismissLabel - Accessible name of the close button (translated).
 */
export function ToastProvider({ children, dismissLabel }: { children: ReactNode; dismissLabel: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );

  const show = useCallback(
    ({ tone = 'info', title, description, duration }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-2), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), duration ?? (tone === 'danger' ? 8000 : 5000));
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={value}>
      {children}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <li
            key={toast.id}
            role={toast.tone === 'danger' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-popover"
          >
            <Icon
              name={TONE_STYLE[toast.tone].icon}
              size="sm"
              className={cn('mt-0.5', TONE_STYLE[toast.tone].classes)}
            />
            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <p className="font-semibold text-fg">{toast.title}</p>
              {toast.description && <p className="text-fg-muted">{toast.description}</p>}
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => dismiss(toast.id)}
              className="rounded-sm p-1 text-fg-subtle hover:bg-surface-muted hover:text-fg"
            >
              <Icon name="x" size="sm" />
            </button>
          </li>
        ))}
      </ol>
    </ToastContext>
  );
}

/**
 * @description Shows toasts from any client component.
 * @returns `{ show }`.
 * @throws Error when used outside {@link ToastProvider}.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
