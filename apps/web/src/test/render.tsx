import { type Locale } from '@offerleap/shared';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { ThemeProvider } from '@/providers/ThemeProvider';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

const MESSAGES = { vi, en };

/**
 * @description Renders a component with the same providers as the app (translations + theme).
 * @param ui - Element to render.
 * @param options - Testing Library options plus the locale to use (default `vi`).
 * @returns The Testing Library render result.
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale = 'vi', ...options }: RenderOptions & { locale?: Locale } = {},
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        <ThemeProvider>{children}</ThemeProvider>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Providers, ...options });
}
