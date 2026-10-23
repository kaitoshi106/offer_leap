'use client';

import { isServer, MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/organisms';
import { currentUserKey } from '@/features/auth/api/use-auth';
import { isSessionEnded } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';

import { ThemeProvider } from './ThemeProvider';

/** Retries after a network or server failure (status 0 or 5xx); a 4xx answer would only come back the same. */
const MAX_RETRIES = 2;

/**
 * @description Default options for the app's QueryClient (also used by tests, which make one per render):
 * - queries retry network and server failures only — a deleted record shows its error at once, not after
 *   seconds of skeleton;
 * - any request that finds the session gone marks the user signed out, so the app shell sends them to the
 *   sign-in page instead of every section showing its own "not signed in" error.
 */
export const makeQueryClient = () => {
  const onError = (error: unknown) => {
    if (isSessionEnded(error)) client.setQueryData(currentUserKey, null);
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failures, error) =>
          failures < MAX_RETRIES && !(isApiError(error) && error.status >= 400 && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
  return client;
};

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
