import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * @description Joins conditional class names and resolves Tailwind conflicts so the last one wins
 * (`cn('px-2', 'px-4')` → `'px-4'`). Lets callers override a component's default classes via `className`.
 * @param inputs - Strings, arrays or `{ class: condition }` objects.
 * @returns A single class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
