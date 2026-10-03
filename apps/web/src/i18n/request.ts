import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

/**
 * @description Per-request i18n config for Server Components: picks the locale from the URL segment
 * (falling back to the default) and loads only that locale's messages.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Fixed zone so server and client format dates identically (avoids hydration mismatches).
    timeZone: 'Asia/Ho_Chi_Minh',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
