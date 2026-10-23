'use client';

import type { MutateOptions, UseMutationResult } from '@tanstack/react-query';
import { useRef } from 'react';

/**
 * @description `mutation.mutate` that ignores calls while one is still running. A button's `loading` /
 * `disabled` state comes from `isPending`, which React Query publishes a moment later, so a fast double click
 * (or Enter pressed twice) would otherwise send the request twice — two onboarding completions, two AI calls
 * charged to the quota. The guard is a ref, set synchronously on the first call.
 * @param mutation - The `useMutation` result.
 * @returns A `mutate` with the same signature.
 */
export function useMutateOnce<TData, TError, TVariables, TContext>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
) {
  const running = useRef(false);

  return (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => {
    if (running.current) return;
    running.current = true;
    mutation.mutate(variables, {
      ...options,
      onSettled: (...args) => {
        running.current = false;
        options?.onSettled?.(...args);
      },
    });
  };
}
