'use client';

import { PAGE_SIZES, type Paginated } from '@offerleap/shared';
import { useTranslations } from 'next-intl';

import { Pagination } from '@/components/molecules';

/**
 * @description The app's pager for a paginated API list: previous / next, "Page 2 of 5" and a 10 / 50 / 100 size
 * picker (offered once the list doesn't fit in the smallest page).
 * @param props.data - The current page from the API.
 * @param props.label - Accessible name of the pager, e.g. "Analysis history pages".
 */
export function ListPagination({
  data,
  label,
  onPageChange,
  onPageSizeChange,
}: {
  data: Pick<Paginated<unknown>, 'total' | 'page' | 'pageSize'>;
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const t = useTranslations('common.pagination');
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <Pagination
      page={data.page}
      pages={pages}
      onChange={onPageChange}
      labels={{
        nav: label,
        previous: t('previous'),
        next: t('next'),
        status: t('status', { page: data.page, pages }),
      }}
      pageSize={
        data.total > PAGE_SIZES[0]
          ? {
              value: data.pageSize,
              options: PAGE_SIZES,
              onChange: onPageSizeChange,
              label: t('pageSize'),
              optionLabel: (size) => t('pageSizeOption', { size }),
            }
          : undefined
      }
    />
  );
}
