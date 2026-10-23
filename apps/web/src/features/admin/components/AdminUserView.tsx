'use client';

import type { AdminUserDetail } from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Avatar, Badge, Button, Heading, Icon, Skeleton, Text } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { Link } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';

import { useAdminUser, useSetUserStatus } from '../api/use-admin';
import { AiQuotaCard } from './AiQuotaCard';
import { SignInMethods } from './SignInMethods';
import { roleKey, STATUS_TONE } from './labels';

/**
 * @description One account for admins: identity, career summary, activity counts, and disable/enable when the
 * viewing admin is allowed to (`manageable`, computed by the API with the shared rule).
 * @param props.id - User id from the URL.
 */
export function AdminUserView({ id }: { id: string }) {
  const t = useTranslations('admin');
  const errorText = useErrorText();
  const { data: user, error, isPending } = useAdminUser(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary-text hover:underline"
      >
        <Icon name="arrow-right" size="sm" className="rotate-180" />
        {t('user.back')}
      </Link>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending && <Skeleton className="h-80 w-full" />}
      {user && <UserDetail user={user} />}
    </div>
  );
}

function UserDetail({ user }: { user: AdminUserDetail }) {
  const t = useTranslations('admin');
  const tLevels = useTranslations('onboarding.levels');
  const format = useFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* min-w-0 + wrap-anywhere: a long email wraps instead of widening the page on small phones. */}
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={user.fullName} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <Heading level={2} size="md" className="wrap-anywhere">
              {user.fullName}
            </Heading>
            <Text tone="muted" size="sm" className="wrap-anywhere">
              {user.email}
            </Text>
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">{t(`roles.${roleKey(user.role, user.adminLevel)}`)}</Badge>
              <Badge tone={STATUS_TONE[user.status]}>{t(`statuses.${user.status}`)}</Badge>
            </div>
          </div>
        </div>
        <StatusAction user={user} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t('user.account')}>
          <Facts
            items={[
              [t('user.createdAt'), date(user.createdAt)],
              [t('user.lastLogin'), user.lastLoginAt ? date(user.lastLoginAt) : t('user.never')],
              [
                t('users.columns.onboarding'),
                user.onboardingCompleted ? t('users.onboardingDone') : t('users.onboardingPending'),
              ],
              [t('users.columns.signIn'), <SignInMethods key="sign-in" methods={user.signInMethods} />],
            ]}
          />
        </Card>
        <Card title={t('user.career')}>
          {user.profile ? (
            <Facts
              items={[
                [t('user.jobTitle'), user.profile.jobTitle ?? '—'],
                [t('user.level'), user.profile.level ? tLevels(user.profile.level) : '—'],
                [
                  t('user.years'),
                  user.profile.yearsOfExperience !== null
                    ? t('user.yearsValue', { years: user.profile.yearsOfExperience })
                    : '—',
                ],
              ]}
            />
          ) : (
            <Text tone="muted">{t('user.noProfile')}</Text>
          )}
        </Card>
      </div>

      <AiQuotaCard key={`${user.id}-${user.ai.override}`} user={user} />

      <Card title={t('user.activity')}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(['resumes', 'analyses', 'applications', 'interviews'] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1 rounded-lg bg-surface-muted/60 p-3">
              <dt className="text-xs text-fg-muted">{t(`user.counts.${key}`)}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{user.activity[key]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card">
      <Heading level={3} size="sm">
        {title}
      </Heading>
      {children}
    </section>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm [&_dd]:wrap-anywhere">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusAction({ user }: { user: AdminUserDetail }) {
  const t = useTranslations('admin.user');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const errorText = useErrorText();
  const setStatus = useSetUserStatus(user.id);
  const [open, setOpen] = useState(false);
  const disabling = user.status === 'ACTIVE';

  if (!user.manageable) {
    return (
      <Text size="sm" tone="muted">
        {t('notManageable')}
      </Text>
    );
  }

  return (
    <>
      <Button variant={disabling ? 'danger' : 'outline'} onClick={() => setOpen(true)}>
        {disabling ? t('disable') : t('enable')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={disabling ? t('disableTitle', { email: user.email }) : t('enableTitle', { email: user.email })}
        description={disabling ? t('disableBody') : t('enableBody')}
        closeLabel={tCommon('close')}
        error={setStatus.error ? errorText(setStatus.error) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant={disabling ? 'danger' : 'primary'}
              loading={setStatus.isPending}
              onClick={() =>
                setStatus.mutate(disabling ? 'DISABLED' : 'ACTIVE', {
                  onSuccess: () => {
                    setOpen(false);
                    toast.show({ tone: 'success', title: disabling ? t('disabled') : t('enabled') });
                  },
                })
              }
            >
              {disabling ? t('disable') : t('enable')}
            </Button>
          </>
        }
      />
    </>
  );
}
