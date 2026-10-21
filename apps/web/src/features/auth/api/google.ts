'use client';

import type { Locale } from '@offerleap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '@/lib/api/client';

import { authApi } from './auth-api';

const authProvidersKey = ['auth', 'providers'] as const;
const signInMethodsKey = ['auth', 'sign-in-methods'] as const;

/** Which sign-in providers the API is configured for. Changes only with a redeploy. */
export function useAuthProviders() {
  return useQuery({
    queryKey: authProvidersKey,
    queryFn: ({ signal }) => authApi.providers(signal),
    staleTime: Infinity,
  });
}

/** Whether the signed-in user has a password, and their linked Google account. */
export function useSignInMethods() {
  return useQuery({ queryKey: signInMethodsKey, queryFn: ({ signal }) => authApi.signInMethods(signal) });
}

export function useUnlinkGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.unlinkGoogle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: signInMethodsKey }),
  });
}

/**
 * @description Where "Continue with Google" goes: a page navigation to the API, which redirects to Google and
 * back. Not a fetch — the browser has to visit Google itself.
 * @param locale - Language of the page to come back to.
 * @param next - Page to open after signing in (checked by the API).
 */
export function googleSignInUrl(locale: Locale, next?: string | null): string {
  const url = new URL(`${API_URL}/auth/google`);
  url.searchParams.set('locale', locale);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

/**
 * @description Starts a Google flow for the signed-in account (link Google, or confirm deleting the account) as a
 * form POST, so another site can't start it with a plain link. The session is checked first so an expired access
 * token is refreshed before the browser leaves the page.
 */
export async function startGoogleAccountFlow(intent: 'link' | 'delete', locale: Locale): Promise<void> {
  await authApi.me();
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${API_URL}/auth/google/${intent}?locale=${locale}`;
  document.body.append(form);
  form.submit();
}
