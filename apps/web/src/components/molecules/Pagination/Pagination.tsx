'use client';

import { cn } from '@/lib/cn';

import { Button, Icon, Select } from '../../atoms';

export interface PageSizeOption {
  value: number;
  /** Sizes to offer, e.g. `[10, 50, 100]`. */
  options: readonly number[];
  onChange: (pageSize: number) => void;
  /** Translated texts: the select's label ("Items per page") and each option ("10 / page"). */
  label: string;
  optionLabel: (pageSize: number) => string;
}

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pages: number;
  onChange: (page: number) => void;
  /** Translated texts, e.g. "Previous page", "Page 2 of 5". */
  labels: { nav: string; previous: string; next: string; status: string };
  /** Lets the user pick how many items a page shows. Omit for a fixed page size. */
  pageSize?: PageSizeOption;
  className?: string;
}

/**
 * @description Previous / next pager with the position in between, plus an optional page-size picker. A labelled
 * `<nav>`; the status is a live region so screen readers hear the new page after moving. The pager is hidden
 * when there is only one page; the picker stays so a larger page size can be undone.
 * @param props - {@link PaginationProps}
 */
export function Pagination({ page, pages, onChange, labels, pageSize, className }: PaginationProps) {
  if (pages <= 1 && !pageSize) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {pageSize && (
        <Select
          aria-label={pageSize.label}
          value={pageSize.value}
          onChange={(event) => pageSize.onChange(Number(event.target.value))}
          wrapperClassName="w-auto"
          className="h-9"
        >
          {pageSize.options.map((size) => (
            <option key={size} value={size}>
              {pageSize.optionLabel(size)}
            </option>
          ))}
        </Select>
      )}
      {pages > 1 && (
        <nav aria-label={labels.nav} className="flex flex-1 items-center justify-between gap-3 sm:flex-none">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            leftIcon={<Icon name="arrow-right" size="sm" className="rotate-180" />}
          >
            {labels.previous}
          </Button>
          <span role="status" className="text-sm text-fg-muted tabular-nums">
            {labels.status}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
            rightIcon={<Icon name="arrow-right" size="sm" />}
          >
            {labels.next}
          </Button>
        </nav>
      )}
    </div>
  );
}
