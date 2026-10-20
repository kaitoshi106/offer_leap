'use client';

import type { AdminUserDetail } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { Badge, Button, Heading, Input, Text } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { useErrorText } from '@/lib/api/use-error-text';

import { useSetAiQuota } from '../api/use-admin';

/**
 * @description A user's AI usage in the last 24 hours and, for accounts the admin may manage, their own limit
 * (empty = default). Admins have no limit, so they only see their usage.
 * @param props.user - Account being viewed.
 * @param props.defaultQuota - AI_DAILY_QUOTA, shown in the hint.
 */
export function AiQuotaCard({ user, defaultQuota }: { user: AdminUserDetail; defaultQuota?: number }) {
  const t = useTranslations('admin.quota');
  const toast = useToast();
  const errorText = useErrorText();
  const setQuota = useSetAiQuota(user.id);
  const [value, setValue] = useState(user.ai.override?.toString() ?? '');
  const { callsInWindow, limit, override } = user.ai;

  function save(event: FormEvent, next: number | null) {
    event.preventDefault();
    setQuota.mutate(next, {
      onSuccess: () => toast.show({ tone: 'success', title: t('saved') }),
      onError: (error) => toast.show({ tone: 'danger', title: errorText(error) }),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Heading level={3} size="sm">
          {t('title')}
        </Heading>
        {limit !== null && (
          <Badge tone={override === null ? 'neutral' : 'ai'}>
            {override === null ? t('isDefault') : t('isOverride')}
          </Badge>
        )}
      </div>
      <Text size="sm">
        {limit === null
          ? t('usedUnlimited', { used: callsInWindow })
          : t('used', { used: callsInWindow, limit })}
      </Text>
      {limit !== null && user.manageable && (
        <form
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => save(event, value.trim() === '' ? null : Number(value))}
        >
          <FormField
            label={t('override')}
            hint={defaultQuota !== undefined ? t('overrideHint', { default: defaultQuota }) : undefined}
            className="min-w-48 flex-1"
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </FormField>
          <Button type="submit" loading={setQuota.isPending}>
            {t('save')}
          </Button>
          {override !== null && (
            <Button
              variant="ghost"
              onClick={(event) => {
                setValue('');
                save(event, null);
              }}
            >
              {t('useDefault')}
            </Button>
          )}
        </form>
      )}
      {setQuota.error && <Alert tone="danger">{errorText(setQuota.error)}</Alert>}
    </section>
  );
}
