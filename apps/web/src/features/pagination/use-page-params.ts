'use client';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize } from '@offerleap/shared';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * @description A page size from the URL, or the default when it is missing or not one we offer (an old or
 * hand-edited link) — so the API never answers 422 to a link.
 * @param value - Raw `pageSize` query value.
 */
export const toPageSize = (value: string | null): PageSize =>
  PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_PAGE_SIZE;

/**
 * @description `?page=&pageSize=` of a list page: read from the URL (shareable, survives a reload, works with Back)
 * and written back with `replace`. Changing the size returns to page 1; defaults stay out of the URL. Needs a
 * Suspense boundary above it (useSearchParams).
 */
export function usePageParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = toPageSize(searchParams.get('pageSize'));

  function write(changes: { page?: number; pageSize?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: number | undefined, fallback: number) => {
      if (value === undefined || value === fallback) params.delete(key);
      else params.set(key, String(value));
    };
    set('page', changes.page, 1);
    if ('pageSize' in changes) set('pageSize', changes.pageSize, DEFAULT_PAGE_SIZE);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return {
    page,
    pageSize,
    setPage: (next: number) => write({ page: next }),
    setPageSize: (next: number) => write({ page: 1, pageSize: next }),
  };
}
