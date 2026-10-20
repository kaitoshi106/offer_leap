'use client';

import { canInviteAdmins } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Heading, Skeleton } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { navLinkClasses } from '@/components/templates';
import { AppShell } from '@/features/app-shell/AppShell';
import { useCurrentUser } from '@/features/auth/api/use-auth';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * @description Layout of the admin pages: the app shell, an admin-only gate and the section tabs (the admins tab
 * only for root). The gate is UX — the API refuses non-admins anyway.
 * @param props.children - Section content.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const { data: user, isPending } = useCurrentUser();

  const tabs = [
    { href: '/admin', label: t('tabs.overview'), exact: true },
    { href: '/admin/users', label: t('tabs.users') },
    { href: '/admin/industries', label: t('tabs.industries') },
    ...(user && canInviteAdmins(user)
      ? [{ href: '/admin/admins', label: t('tabs.admins'), exact: false }]
      : []),
  ];

  return (
    <AppShell>
      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : user?.role !== 'ADMIN' ? (
        <Alert tone="danger">{t('forbidden')}</Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 border-b border-border pb-4">
            <Heading level={1} size="lg">
              {t('title')}
            </Heading>
            <nav aria-label={t('tabs.label')}>
              <ul className="flex gap-1">
                {tabs.map(({ href, label, exact }) => {
                  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={navLinkClasses(active)}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          {children}
        </div>
      )}
    </AppShell>
  );
}
