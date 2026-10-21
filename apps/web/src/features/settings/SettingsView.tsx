'use client';

import {
  canDeleteOwnAccount,
  canManageOwnPassword,
  type ChangePasswordInput,
  changePasswordSchema,
} from '@offerleap/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { Avatar, Button, Heading, Skeleton, Text } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { roleKey } from '@/features/admin/components/labels';
import { authApi } from '@/features/auth/api/auth-api';
import { currentUserKey, useCurrentUser } from '@/features/auth/api/use-auth';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { DeleteAccount, ExportDataButton } from './AccountDataSections';

/**
 * `/settings`: account details, password change, data export and account deletion (root can neither change its
 * password nor delete itself — both are managed by config).
 */
export function SettingsView() {
  const t = useTranslations('settings');
  const tAdmin = useTranslations('admin');
  const { data: user, isPending } = useCurrentUser();

  if (isPending || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Heading level={1} size="lg">
        {t('title')}
      </Heading>
      <Section title={t('account')}>
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} size="lg" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-fg-muted">{t('name')}</dt>
            <dd>{user.fullName}</dd>
            <dt className="text-fg-muted">{t('email')}</dt>
            <dd>{user.email}</dd>
            <dt className="text-fg-muted">{t('role')}</dt>
            <dd>{tAdmin(`roles.${roleKey(user.role, user.adminLevel)}`)}</dd>
          </dl>
        </div>
      </Section>
      <Section title={t('password')} description={t('passwordDescription')}>
        {canManageOwnPassword(user) ? <ChangePasswordForm /> : <Alert tone="info">{t('rootPassword')}</Alert>}
      </Section>
      <Section title={t('data.title')} description={t('data.description')}>
        <ExportDataButton />
      </Section>
      {canDeleteOwnAccount(user) && (
        <Section title={t('delete.sectionTitle')} description={t('delete.description')}>
          <DeleteAccount />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-1">
        <Heading level={2} size="sm">
          {title}
        </Heading>
        {description && (
          <Text size="sm" tone="muted">
            {description}
          </Text>
        )}
      </div>
      {children}
    </section>
  );
}

function ChangePasswordForm() {
  const t = useTranslations();
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordInput>({
    resolver: sharedSchemaResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (session) => {
      // The API started a fresh session (other devices are signed out); this tab keeps working.
      queryClient.setQueryData(currentUserKey, session.user);
      form.reset();
      toast.show({ tone: 'success', title: t('settings.changed') });
    },
    onError: (error) => {
      if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
    },
  });
  const { errors } = form.formState;
  const generalError = change.error && !(isApiError(change.error) && change.error.fieldErrors.length > 0);
  const passwordProps = { showLabel: t('common.showPassword'), hideLabel: t('common.hidePassword') };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => change.mutate(values))}
      className="flex flex-col gap-4"
    >
      {generalError && <Alert tone="danger">{errorText(change.error)}</Alert>}
      <FormField label={t('settings.currentPassword')} error={fieldError(errors.currentPassword)} required>
        {(field) => (
          <PasswordInput
            {...field}
            {...form.register('currentPassword')}
            autoComplete="current-password"
            {...passwordProps}
          />
        )}
      </FormField>
      <FormField
        label={t('auth.fields.newPassword')}
        hint={t('auth.fields.passwordHint')}
        error={fieldError(errors.newPassword)}
        required
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...form.register('newPassword')}
            autoComplete="new-password"
            {...passwordProps}
          />
        )}
      </FormField>
      <Button type="submit" className="self-end" loading={change.isPending}>
        {t('settings.submit')}
      </Button>
    </form>
  );
}
