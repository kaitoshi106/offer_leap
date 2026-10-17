'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { FocusLayout } from '@/components/templates';
import { useLogout } from '@/features/auth/api/use-auth';

import { OnboardingWizard } from './OnboardingWizard';

/** Onboarding page body: focus layout with a sign-out action (users may leave before finishing). */
export function OnboardingView() {
  const t = useTranslations('onboarding.actions');
  const logout = useLogout();

  return (
    <FocusLayout
      actions={
        <Button variant="ghost" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
          {t('signOut')}
        </Button>
      }
    >
      <OnboardingWizard />
    </FocusLayout>
  );
}
