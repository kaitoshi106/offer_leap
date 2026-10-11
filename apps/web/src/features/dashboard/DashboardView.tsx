'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Avatar, Badge, Button, Heading, Icon, Skeleton, Text } from '@/components/atoms';
import { Alert, LocaleSwitcher, ThemeToggle } from '@/components/molecules';
import { useCurrentUser, useLogout } from '@/features/auth/api/use-auth';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';

/**
 * @description Temporary signed-in home: shows the session works end to end (cookies, refresh, `/auth/me`) and
 * offers sign-out. Replaced by the real dashboard later.
 */
export function DashboardView() {
  const t = useTranslations('dashboard');
  const redirect = useAuthRedirect();
  const errorText = useErrorText();
  const { data: user, error, isPending } = useCurrentUser();
  const logout = useLogout();

  // The proxy only checks that a session cookie exists; if the session turns out to be dead, go sign in.
  // Skipped while signing out: that flow navigates to /login itself (without `next`).
  const signingOut = !logout.isIdle;
  useEffect(() => {
    if (user === null && !signingOut) redirect('/login?next=/dashboard');
  }, [user, signingOut, redirect]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          <Icon name="sparkles" className="text-primary" />
          {t('title')}
        </span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="flex flex-col gap-6">
        {error && <Alert tone="danger">{errorText(error)}</Alert>}
        {isPending || !user ? (
          <div aria-busy className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={user.fullName} size="lg" />
              <div className="flex flex-col gap-1">
                <Heading level={1} size="lg">
                  {t('greeting', { name: user.fullName })}
                </Heading>
                <Text tone="muted" className="flex items-center gap-2">
                  {user.email}
                  <Badge tone={user.role === 'ADMIN' ? 'primary' : 'neutral'}>
                    {user.adminLevel ? `${user.role} · ${user.adminLevel}` : user.role}
                  </Badge>
                </Text>
              </div>
            </div>
            <Alert tone="info">{t('comingSoon')}</Alert>
            <div>
              <Button
                variant="outline"
                leftIcon={<Icon name="arrow-right" size="sm" />}
                loading={logout.isPending}
                onClick={() => logout.mutate(undefined, { onSettled: () => redirect('/login') })}
              >
                {t('signOut')}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
