'use client';

import { ONBOARDING_STEPS, type OnboardingStep } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Heading, Skeleton, Text } from '@/components/atoms';
import { Alert, Stepper } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { useCurrentUser } from '@/features/auth/api/use-auth';
import { useRouter } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';

import { useOnboardingState } from '../api/use-onboarding';
import { CareerStep } from './CareerStep';
import { PersonalStep } from './PersonalStep';
import { PreferencesStep } from './PreferencesStep';
import { ReviewStep } from './ReviewStep';

/**
 * @description The onboarding wizard: resumes at the saved step, saves each step before moving on, and sends the
 * user to the dashboard once the profile is complete. Moving between steps focuses the step title so screen
 * readers announce where the user is.
 */
export function OnboardingWizard() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const redirect = useAuthRedirect();
  const toast = useToast();
  const errorText = useErrorText();
  const { data: user } = useCurrentUser();
  const { data: state, error, isPending } = useOnboardingState();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Only signed-in USERs who haven't finished belong here.
  useEffect(() => {
    if (user === null) redirect('/login?next=/onboarding');
    else if (user?.role === 'ADMIN' || state?.completed) router.replace('/dashboard');
  }, [user, state?.completed, router, redirect]);

  if (error) return <Alert tone="danger">{errorText(error)}</Alert>;
  if (isPending || !state) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const current = stepIndex ?? ONBOARDING_STEPS.indexOf(state.step);
  const step = ONBOARDING_STEPS[current] ?? 'personal';

  function goTo(target: OnboardingStep, options?: { incomplete?: boolean }) {
    setStepIndex(ONBOARDING_STEPS.indexOf(target));
    setIncomplete(Boolean(options?.incomplete));
    // Wait for the new step to render, then move focus to its title.
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  const next = () => goTo(ONBOARDING_STEPS[Math.min(current + 1, ONBOARDING_STEPS.length - 1)]!);
  const back = () => goTo(ONBOARDING_STEPS[Math.max(current - 1, 0)]!);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="lg">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('description')}</Text>
      </div>

      <Stepper
        label={t('progress')}
        completedLabel={t('completedStep')}
        current={current}
        steps={ONBOARDING_STEPS.map((key) => ({ key, label: t(`steps.${key}`) }))}
      />

      <section
        aria-labelledby="onboarding-step-title"
        className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8"
      >
        <Heading
          level={2}
          size="sm"
          id="onboarding-step-title"
          ref={titleRef}
          tabIndex={-1}
          className="mb-6 outline-none"
        >
          {t(`stepTitles.${step}`)}
        </Heading>
        {incomplete && (
          <Alert tone="warning" className="mb-6">
            {t('incomplete')}
          </Alert>
        )}

        {step === 'personal' && <PersonalStep key={step} values={state.values} onSaved={next} />}
        {step === 'career' && <CareerStep key={step} values={state.values} onSaved={next} onBack={back} />}
        {step === 'preferences' && (
          <PreferencesStep key={step} values={state.values} onSaved={next} onBack={back} />
        )}
        {step === 'review' && (
          <ReviewStep
            values={state.values}
            onEdit={goTo}
            onBack={back}
            onCompleted={() => {
              toast.show({ tone: 'success', title: t('done') });
              router.replace('/dashboard');
            }}
          />
        )}
      </section>
    </div>
  );
}
