'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { ToastProvider } from '@/components/organisms';

import { ThemeProvider } from './ThemeProvider';

/**
 * @description Client-side providers shared by every page: theme, server-state cache (React Query) and toasts.
 * The QueryClient lives in state so each browser tab gets one instance and the server never shares it between
 * requests.
 * @param props.children - App subtree.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false }, mutations: { retry: false } },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider dismissLabel={t('dismiss')}>{children}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
