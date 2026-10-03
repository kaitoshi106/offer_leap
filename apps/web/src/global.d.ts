import type { Locale } from '@offerleap/shared';

import type messages from '../messages/vi.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    // `vi` is the source of truth; a test keeps `en` in sync with it.
    Messages: typeof messages;
  }
}
