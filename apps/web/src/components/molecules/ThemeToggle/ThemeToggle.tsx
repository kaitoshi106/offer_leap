'use client';

import { useTranslations } from 'next-intl';

import { Button, Icon, type IconName } from '@/components/atoms';
import { type ThemePreference } from '@/lib/theme';
import { useTheme } from '@/providers/ThemeProvider';

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const PREFERENCE_ICON: Record<ThemePreference, IconName> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

/**
 * @description Icon button cycling light → dark → system. The accessible name states the current choice.
 * @param props.className - Extra classes for positioning.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  const { preference, setPreference } = useTheme();
  const label = t('label', { theme: t(preference) });

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setPreference(NEXT_PREFERENCE[preference])}
      className={className}
    >
      <Icon name={PREFERENCE_ICON[preference]} />
    </Button>
  );
}
