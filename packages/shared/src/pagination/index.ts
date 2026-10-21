import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '../constants/app';

/** One page of a list. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `?page=&pageSize=` of every paginated list (strings in the URL, coerced). Only the sizes offered in the UI are
 * accepted, so a crafted URL can't ask for a huge page.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.literal(PAGE_SIZES)).default(DEFAULT_PAGE_SIZE),
});

export type PageQuery = z.output<typeof pageQuerySchema>;
