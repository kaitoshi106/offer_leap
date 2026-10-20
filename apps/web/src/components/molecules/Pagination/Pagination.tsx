'use client';

import { cn } from '@/lib/cn';

import { Button, Icon } from '../../atoms';

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pages: number;
  onChange: (page: number) => void;
  /** Translated texts, e.g. "Previous page", "Page 2 of 5". */
  labels: { nav: string; previous: string; next: string; status: string };
  className?: string;
}

/**
 * @description Previous / next pager with the position in between. A labelled `<nav>`; the status is a live
 * region so screen readers hear the new page after moving. Hidden when there is only one page.
 * @param props - {@link PaginationProps}
 */
export function Pagination({ page, pages, onChange, labels, className }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={labels.nav} className={cn('flex items-center justify-between gap-3', className)}>
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
  );
}
