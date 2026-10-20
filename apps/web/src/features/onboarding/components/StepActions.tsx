'use client';

import { useTranslations } from 'next-intl';

import { Button, Icon } from '@/components/atoms';

/**
 * @description Back / Continue row shared by the wizard steps. "Continue" submits the step's form.
 * @param props.onBack - Omit on the first step.
 * @param props.loading - While the step is being saved.
 * @param props.submitLabel - Overrides "Continue" (e.g. "Finish").
 * @param props.icon - Arrow on the submit button (off for a plain "Save").
 */
export function StepActions({
  onBack,
  loading,
  submitLabel,
  icon = true,
}: {
  onBack?: () => void;
  loading?: boolean;
  submitLabel?: string;
  icon?: boolean;
}) {
  const t = useTranslations('onboarding.actions');
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          {t('back')}
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="submit"
        loading={loading}
        rightIcon={icon ? <Icon name="arrow-right" size="sm" /> : undefined}
      >
        {submitLabel ?? t('next')}
      </Button>
    </div>
  );
}
