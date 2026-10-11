'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { isApiError } from './errors';

/**
 * @description Translates any thrown value into a user-facing message via `errors.<CODE>`.
 * @returns `(error) => string`.
 */
export function useErrorText(): (error: unknown) => string {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown) => (isApiError(error) && t.has(error.code) ? t(error.code) : t('COMMON_INTERNAL_ERROR')),
    [t],
  );
}
