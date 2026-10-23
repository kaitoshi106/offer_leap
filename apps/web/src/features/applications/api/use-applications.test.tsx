import type { ApplicationSummary } from '@offerleap/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useTopOfColumn } from './use-applications';

const card = (id: string, status: ApplicationSummary['status'], position: number) =>
  ({ id, status, position }) as ApplicationSummary;

function renderWithBoard(cards?: ApplicationSummary[]) {
  const client = new QueryClient();
  if (cards) client.setQueryData(['applications'], cards);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTopOfColumn(), { wrapper }).result.current;
}

describe('useTopOfColumn', () => {
  it("puts a card moved from its page above the target column's first card, not next to its old place", () => {
    const topOf = renderWithBoard([card('a', 'SAVED', 5), card('b', 'APPLIED', 2), card('c', 'APPLIED', 7)]);
    expect(topOf('a', 'APPLIED', 4)).toBe(1);
    // An empty column, and the card's own column (it doesn't count itself).
    expect(topOf('a', 'OFFER', 4)).toBe(0);
    expect(topOf('b', 'APPLIED', 1)).toBe(6);
  });

  it('falls back when the board was never loaded (page opened directly)', () => {
    expect(renderWithBoard()('a', 'APPLIED', 4)).toBe(4);
  });
});
