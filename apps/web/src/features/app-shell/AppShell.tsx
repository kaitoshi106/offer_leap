'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Avatar, Button, Icon, type IconName, VisuallyHidden } from '@/components/atoms';
import { AppLayout, navLinkClasses } from '@/components/templates';
import { useCurrentUser, useLogout } from '@/features/auth/api/use-auth';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthRedirect } from '@/lib/auth-redirect';

type NavItem = {
  href: string;
  key: 'dashboard' | 'analyses' | 'applications' | 'interviews' | 'documents' | 'profile' | 'admin';
  icon: IconName;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: 'home' },
  { href: '/analyses', key: 'analyses', icon: 'target' },
  { href: '/applications', key: 'applications', icon: 'file-text' },
  { href: '/interviews', key: 'interviews', icon: 'message-square' },
  { href: '/documents', key: 'documents', icon: 'book' },
];
const ADMIN_ITEM: NavItem = { href: '/admin', key: 'admin', icon: 'shield' };
/** Admins have no career profile (they skip onboarding). */
const PROFILE_ITEM: NavItem = { href: '/profile', key: 'profile', icon: 'user' };

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
      // The admin link is UX only: the admin API checks the role itself.
      nav={[...NAV_ITEMS, ...(user?.role === 'ADMIN' ? [ADMIN_ITEM] : [PROFILE_ITEM])].map(
        ({ href, key, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link href={href} aria-current={active ? 'page' : undefined} className={navLinkClasses(active)}>
                <Icon name={icon} size="sm" />
                {t(key)}
              </Link>
            </li>
          );
        },
      )}
      actions={
        <>
          {user && (
            <Link
              href="/settings"
              title={t('settings')}
              className="hidden rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:inline-flex"
            >
              {/* The initials are decoration; hidden text names the link. An aria-label would differ from the
                  visible initials, which speech-input users can't then say (WCAG 2.5.3 Label in Name). */}
              <Avatar name={user.fullName} size="sm" aria-hidden />
              <VisuallyHidden>{t('settings')}</VisuallyHidden>
            </Link>
          )}
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
