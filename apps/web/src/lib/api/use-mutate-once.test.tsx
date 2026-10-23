import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useMutateOnce } from './use-mutate-once';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useMutateOnce', () => {
  it('ignores a second call while the first is still running (a double click sends one request)', async () => {
    let finish: (value: string) => void = () => {};
    const request = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => {
        const mutation = useMutation({ mutationFn: request });
        return useMutateOnce(mutation);
      },
      { wrapper },
    );

    act(() => {
      // Both clicks land before React re-renders with `isPending`.
      result.current(undefined, { onSuccess });
      result.current(undefined, { onSuccess });
    });
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request).toHaveBeenCalledOnce();

    await act(async () => finish('done'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

    // Once settled, it can be sent again.
    act(() => result.current(undefined));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('can be sent again after a failure', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok');
    const onError = vi.fn();
    const { result } = renderHook(() => useMutateOnce(useMutation({ mutationFn: request })), { wrapper });

    act(() => result.current(undefined, { onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    act(() => result.current(undefined));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
