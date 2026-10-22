'use client';

import type { OnboardingStep, ProfileValues } from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Badge, Button, Heading } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';

import { useCompleteOnboarding, useTaxonomies } from '../api/use-onboarding';
import { FIELD_STEP, toOptions } from './options';
import { StepActions } from './StepActions';

interface ReviewStepProps {
  values: ProfileValues;
  /** `incomplete` is set when finishing failed because of this step. */
  onEdit: (step: Exclude<OnboardingStep, 'review'>, options?: { incomplete?: boolean }) => void;
  onBack: () => void;
  onCompleted: () => void;
}

/** Step 4: read-only summary with "Edit" links per section, then finish. */
export function ReviewStep({ values, onEdit, onBack, onCompleted }: ReviewStepProps) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const errorText = useErrorText();
  const { industries, provinces } = useTaxonomies();
  const complete = useCompleteOnboarding();

  const label = (options: { value: string; label: string }[], code: string | null) =>
    options.find((option) => option.value === code)?.label ?? code;
  const missing = <span className="text-fg-subtle">{t('review.notProvided')}</span>;
  const salary = () => {
    const { expectedSalaryMin: min, expectedSalaryMax: max } = values;
    if (min != null && max != null) return t('review.salaryRange', { min, max });
    if (min != null) return t('review.salaryFrom', { min });
    if (max != null) return t('review.salaryTo', { max });
    return missing;
  };

  function finish() {
    complete.mutate(undefined, {
      onSuccess: onCompleted,
      onError: (error) => {
        // The draft is incomplete: open the first step that has a problem.
        const field = isApiError(error) ? error.fieldErrors[0]?.field : undefined;
        if (field && FIELD_STEP[field]) onEdit(FIELD_STEP[field], { incomplete: true });
      },
    });
  }

  const sections: { step: Exclude<OnboardingStep, 'review'>; rows: [string, ReactNode][] }[] = [
    {
      step: 'personal',
      rows: [
        [t('fields.fullName'), values.fullName],
        [t('fields.phone'), values.phone ?? missing],
        [t('fields.province'), label(toOptions(provinces.data, locale), values.provinceCode) ?? missing],
      ],
    },
    {
      step: 'career',
      rows: [
        [t('fields.industry'), label(toOptions(industries.data, locale), values.industryCode) ?? missing],
        [t('fields.jobTitle'), values.jobTitle ?? missing],
        [t('fields.level'), values.level ? t(`levels.${values.level}`) : missing],
        [
          t('fields.years'),
          values.yearsOfExperience != null ? t('review.years', { years: values.yearsOfExperience }) : missing,
        ],
        [
          t('fields.skills'),
          values.skills.length ? (
            <span className="flex flex-wrap gap-1.5">
              {values.skills.map((skill) => (
                <Badge key={skill} tone="primary">
                  {skill}
                </Badge>
              ))}
            </span>
          ) : (
            missing
          ),
        ],
      ],
    },
    {
      step: 'preferences',
      rows: [
        [t('fields.salary'), salary()],
        [
          t('fields.workTypes'),
          values.workTypes.length
            ? values.workTypes.map((type) => t(`workTypes.${type}`)).join(', ')
            : missing,
        ],
      ],
    },
  ];

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        finish();
      }}
      className="flex flex-col gap-6"
    >
      {complete.error && <Alert tone="danger">{errorText(complete.error)}</Alert>}
      {sections.map(({ step, rows }) => (
        <section
          key={step}
          aria-labelledby={`review-${step}`}
          className="rounded-lg border border-border p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <Heading level={3} size="xs" id={`review-${step}`}>
              {t(`stepTitles.${step}`)}
            </Heading>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(step)}
              aria-describedby={`review-${step}`}
            >
              {t('actions.edit')}
            </Button>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {rows.map(([term, detail]) => (
              <div key={term} className="contents">
                <dt className="text-fg-muted">{term}</dt>
                <dd className="text-fg">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <StepActions onBack={onBack} loading={complete.isPending} submitLabel={t('actions.finish')} />
    </form>
  );
}
