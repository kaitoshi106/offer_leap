'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { useTheme } from '@/providers/ThemeProvider';

import { Icon } from '../../atoms';

/**
 * @description Light/dark switch (`role="switch"`, checked = dark). The thumb shows the active mode's icon.
 * Its look comes from the `data-theme` attribute (CSS), not from React state: the server can't know the OS
 * theme, so state-driven styles would first render light and then slide to dark after hydration. With CSS the
 * switch is right from the first paint and only animates when the user flips it.
 * @param props.className - Extra classes for positioning.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label={t('darkMode')}
      title={t('darkMode')}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong bg-surface-muted transition-colors',
        // `[[data-theme=dark]_&]:` = when <html data-theme="dark">, set by the init script before the first paint.
        '[[data-theme=dark]_&]:border-primary [[data-theme=dark]_&]:bg-primary',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-5 translate-x-0.5 items-center justify-center rounded-full bg-surface text-fg shadow-card transition-transform motion-reduce:transition-none',
          '[[data-theme=dark]_&]:translate-x-6',
        )}
      >
        <Icon name="sun" size="xs" className="[[data-theme=dark]_&]:hidden" />
        <Icon name="moon" size="xs" className="hidden [[data-theme=dark]_&]:inline" />
      </span>
    </button>
  );
}
