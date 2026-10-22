'use client';

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/organisms';

import { ThemeProvider } from './ThemeProvider';

/** Default options for the app's QueryClient (also used by tests, which make one per render). */
export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false }, mutations: { retry: false } },
  });

let browserQueryClient: QueryClient | undefined;

/**
 * @description One QueryClient per browser tab, kept outside React: switching the language re-renders the root
 * layout and remounts these providers, and a client held in state would start an empty cache (every page back to
 * skeletons). On the server each request gets its own, so users' data is never shared.
 */
function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

/**
 * @description Client-side providers shared by every page: theme, server-state cache (React Query) and toasts.
 * @param props.children - App subtree.
 * @param props.queryClient - Overrides the tab-wide client (tests pass a fresh one per render).
 */
export function AppProviders({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const t = useTranslations('common');
  const client = queryClient ?? getQueryClient();

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider dismissLabel={t('dismiss')}>{children}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
