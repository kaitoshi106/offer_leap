import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeApi } from './knowledge-api';
import { useDeleteDocument } from './use-knowledge';

describe('useDeleteDocument', () => {
  it('also refreshes search results, so a deleted document stops showing up in them', async () => {
    vi.spyOn(knowledgeApi, 'remove').mockResolvedValue(undefined);
    const client = new QueryClient();
    client.setQueryData(['knowledge', 'search', 'react'], { results: [{ documentId: 'd1' }] });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    act(() => result.current.mutate('d1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.getQueryState(['knowledge', 'search', 'react'])?.isInvalidated).toBe(true);
  });
});
