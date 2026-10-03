import type { Ref, RefCallback } from 'react';

/**
 * @description Combines several refs into one callback ref, so a component can keep its own ref to a DOM node
 * while still forwarding the caller's `ref`.
 * @param refs - Callback refs, ref objects or nothing.
 * @returns A callback ref that writes the node to every given ref.
 */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }
  };
}
