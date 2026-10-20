'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Avatar, Button, Icon, type IconName } from '@/components/atoms';
import { AppLayout, navLinkClasses } from '@/components/templates';
import { useCurrentUser, useLogout } from '@/features/auth/api/use-auth';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthRedirect } from '@/lib/auth-redirect';

const NAV_ITEMS: { href: string; key: 'dashboard' | 'analyses'; icon: IconName }[] = [
  { href: '/dashboard', key: 'dashboard', icon: 'user' },
  { href: '/analyses', key: 'analyses', icon: 'target' },
];

/**
 * @description Layout for signed-in pages: navigation, account and sign-out. Also enforces what the proxy can't
 * know: a dead session goes to the login page, and users who haven't finished onboarding go back to it.
 * @param props.children - Page content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const redirect = useAuthRedirect();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  useEffect(() => {
    if (user === null) redirect(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user?.role === 'USER' && !user.onboardingCompleted) router.replace('/onboarding');
  }, [user, pathname, router, redirect]);

  return (
    <AppLayout
      brand={(content) => (
        <Link
          href="/dashboard"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          {content}
        </Link>
      )}
      navLabel={t('label')}
      nav={NAV_ITEMS.map(({ href, key, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={key}>
            <Link href={href} aria-current={active ? 'page' : undefined} className={navLinkClasses(active)}>
              <Icon name={icon} size="sm" />
              {t(key)}
            </Link>
          </li>
        );
      })}
      actions={
        <>
          {user && <Avatar name={user.fullName} size="sm" className="hidden sm:inline-flex" />}
          <Button variant="ghost" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
            {t('signOut')}
          </Button>
        </>
      }
    >
      {children}
    </AppLayout>
  );
}
