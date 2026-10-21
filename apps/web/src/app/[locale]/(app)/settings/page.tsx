import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import type { Locale } from '@offerleap/shared';

import { AppShell } from '@/features/app-shell/AppShell';
import { SettingsView } from '@/features/settings/SettingsView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('metaTitle') };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  setRequestLocale((await params).locale);
  return (
    <AppShell>
      {/* Google flows report back in the URL (`?linked=`, `?error=`), which needs a Suspense boundary. */}
      <Suspense>
        <SettingsView />
      </Suspense>
    </AppShell>
  );
}
