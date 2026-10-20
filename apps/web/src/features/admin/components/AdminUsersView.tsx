'use client';

import {
  type AdminUsersQueryInput,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  Role,
  USER_STATUSES,
} from '@offerleap/shared';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Avatar, Badge, Input, Select, Skeleton, Text } from '@/components/atoms';
import { Alert, Pagination } from '@/components/molecules';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAdminUsers } from '../api/use-admin';
import { roleKey, STATUS_TONE } from './labels';

const SEARCH_DELAY_MS = 300;

/** A size from the URL, or the default when it is missing or not one we offer (an old or hand-edited link). */
const toPageSize = (value: string | null) =>
  PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_PAGE_SIZE;

/**
 * @description Paginated, searchable list of accounts. Filters, page and page size live in the URL
 * (`?q=&role=&status=&page=&pageSize=`)
 * so a filtered list can be shared, survives a reload and works with the back button.
 */
export function AdminUsersView() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const errorText = useErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query: AdminUsersQueryInput = {
    q: searchParams.get('q') ?? undefined,
    role: (searchParams.get('role') as AdminUsersQueryInput['role']) ?? undefined,
    status: (searchParams.get('status') as AdminUsersQueryInput['status']) ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: toPageSize(searchParams.get('pageSize')),
  };
  const { data, error, isPending, isPlaceholderData } = useAdminUsers(query);
  const [search, setSearch] = useState(query.q ?? '');

  /** Writes filters to the URL; any filter or page-size change goes back to page 1. */
  function update(
    changes: Partial<Record<'q' | 'role' | 'status' | 'page' | 'pageSize', string | undefined>>,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!('page' in changes)) params.delete('page');
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Search as you type, once typing pauses.
  useEffect(() => {
    if (search === (query.q ?? '')) return;
    const timer = setTimeout(() => update({ q: search.trim() || undefined }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the typed text
  }, [search]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="search"
          aria-label={t('users.search')}
          placeholder={t('users.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label={t('users.role')}
          value={query.role ?? ''}
          onChange={(event) => update({ role: event.target.value || undefined })}
        >
          <option value="">
            {t('users.role')}: {t('users.all')}
          </option>
          {Object.values(Role).map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('users.status')}
          value={query.status ?? ''}
          onChange={(event) => update({ status: event.target.value || undefined })}
        >
          <option value="">
            {t('users.status')}: {t('users.all')}
          </option>
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        data && (
          <>
            <Text size="sm" tone="muted" role="status">
              {t('users.total', { total: data.total })}
            </Text>
            {data.items.length === 0 ? (
              <Text tone="muted">{t('users.empty')}</Text>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
                <table aria-busy={isPlaceholderData} className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted/60 text-xs text-fg-muted uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('users.columns.name')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('users.columns.role')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('users.columns.status')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('users.columns.onboarding')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('users.columns.createdAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-muted/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.fullName} size="sm" />
                            <div className="flex min-w-0 flex-col">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="truncate font-medium text-fg hover:text-primary-text hover:underline"
                              >
                                {user.fullName}
                              </Link>
                              <span className="truncate text-xs text-fg-muted">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{t(`roles.${roleKey(user.role, user.adminLevel)}`)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[user.status]}>{t(`statuses.${user.status}`)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {!user.emailVerified
                            ? t('users.unverified')
                            : user.role === 'USER'
                              ? t(
                                  user.onboardingCompleted
                                    ? 'users.onboardingDone'
                                    : 'users.onboardingPending',
                                )
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={data.page}
              pages={pages}
              onChange={(page) => update({ page: String(page) })}
              labels={{
                nav: t('users.title'),
                previous: t('users.previous'),
                next: t('users.next'),
                status: t('users.page', { page: data.page, pages }),
              }}
              // Worth offering only when the list doesn't fit in the smallest page.
              pageSize={
                data.total > PAGE_SIZES[0]
                  ? {
                      value: data.pageSize,
                      options: PAGE_SIZES,
                      // The default size stays out of the URL.
                      onChange: (size) =>
                        update({ pageSize: size === DEFAULT_PAGE_SIZE ? undefined : String(size) }),
                      label: t('users.pageSize'),
                      optionLabel: (size) => t('users.pageSizeOption', { size }),
                    }
                  : undefined
              }
            />
          </>
        )
      )}
    </div>
  );
}
