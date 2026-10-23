'use client';

import { useEffect, useEffectEvent } from 'react';

/**
 * @description Warns before unsaved changes are lost: the browser's own prompt when the tab is closed or reloaded,
 * and a confirmation when a link on the page is followed (the App Router has no "before navigate" hook, so link
 * clicks are caught on the document before the router sees them). Links that open elsewhere are left alone.
 * @param dirty - Whether the form has unsaved changes.
 * @param message - Translated question, e.g. "Leave without saving your changes?".
 */
export function useUnsavedChangesWarning(dirty: boolean, message: string) {
  // Always the current wording (e.g. after a language switch) without re-subscribing.
  const confirmLeave = useEffectEvent(() => window.confirm(message));

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      if (link.origin !== window.location.origin) return;
      if (confirmLeave()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    // Capture phase on the document: runs before React's and the router's click handlers.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
