import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { APP_NAME, APP_TAGLINE, DEFAULT_LOCALE } from '@offerleap/shared';

import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
