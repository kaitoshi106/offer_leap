'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { useTheme } from '@/providers/ThemeProvider';

import { Icon } from '../../atoms';

/**
 * @description Light/dark switch (`role="switch"`, checked = dark). The thumb shows the active mode's icon.
 * @param props.className - Extra classes for positioning.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t('darkMode')}
      title={t('darkMode')}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong bg-surface-muted transition-colors',
        dark && 'border-primary bg-primary',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full bg-surface text-fg shadow-card transition-transform motion-reduce:transition-none',
          dark ? 'translate-x-6' : 'translate-x-0.5',
        )}
      >
        <Icon name={dark ? 'moon' : 'sun'} size="xs" />
      </span>
    </button>
  );
}
