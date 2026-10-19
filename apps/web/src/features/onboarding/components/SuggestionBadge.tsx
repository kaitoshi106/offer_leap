'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Badge, Icon } from '@/components/atoms';

import type { SuggestionState } from './suggestions';

/**
 * @description FormField props for a field pre-filled from the CV: an "AI suggested" badge, and for values the
 * AI was unsure about a hint asking the user to check (linked to the input, so screen readers read it too).
 * @returns `(state, hint?) => { badge, hint }` to spread on `FormField`.
 */
export function useSuggestionProps() {
  const t = useTranslations('onboarding.suggestion');
  return (state: SuggestionState | undefined, hint?: ReactNode) => ({
    badge: state && (
      <Badge tone="ai" icon={<Icon name="sparkles" size="xs" />}>
        {t('badge')}
      </Badge>
    ),
    hint: state === 'check' ? t('check') : hint,
  });
}
