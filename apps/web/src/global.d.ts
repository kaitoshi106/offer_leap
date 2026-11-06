import type { Locale } from '@offerleap/shared';

import type messages from '../messages/vi.json';

declare global {
  /** A mounted scrollcraft engine (vendored in `public/vendor/scrollcraft`, used by the landing page only). */
  interface ScrollCraftInstance {
    /** Removes its listeners, loops and observers. Safe to call twice. */
    destroy(): void;
  }

  interface Window {
    ScrollCraft?: { mount(root: Element | string, options?: Record<string, unknown>): ScrollCraftInstance };
  }
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    // `vi` is the source of truth; a test keeps `en` in sync with it.
    Messages: typeof messages;
  }
}
