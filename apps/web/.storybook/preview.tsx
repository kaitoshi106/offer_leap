import { DEFAULT_LOCALE, isLocale } from '@offerleap/shared';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';

import en from '../messages/en.json';
import vi from '../messages/vi.json';
import { roboto } from '../src/app/fonts';

import '../src/app/globals.css';

const MESSAGES = { vi, en };

// The app sets the font variable on <html> in its layout; Storybook has no layout, so do it here.
document.documentElement.classList.add(roboto.variable);

const preview: Preview = {
  // Generates a Docs page (props table + JSDoc) for every component.
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i } },
    a11y: { test: 'error' },
  },
  // Free text for children everywhere; refs are not editable.
  argTypes: {
    children: { control: 'text' },
    ref: { table: { disable: true } },
  },
  globalTypes: {
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'vi', title: 'Tiếng Việt' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: DEFAULT_LOCALE },
  decorators: [
    (Story, { globals }) => {
      const locale = isLocale(globals.locale) ? globals.locale : DEFAULT_LOCALE;
      document.documentElement.lang = locale;
      return (
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Ho_Chi_Minh">
          <Story />
        </NextIntlClientProvider>
      );
    },
    // Toolbar switch for light/dark; sets <html data-theme> like the app does.
    withThemeByDataAttribute({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
