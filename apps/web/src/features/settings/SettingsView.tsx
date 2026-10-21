'use client';

import {
  canDeleteOwnAccount,
  canManageOwnPassword,
  canUseSignInProviders,
  ErrorCode,
  type ChangePasswordInput,
  changePasswordSchema,
} from '@offerleap/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Avatar, Button, Heading, Skeleton, Text } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { roleKey } from '@/features/admin/components/labels';
import { authApi } from '@/features/auth/api/auth-api';
import { useAuthProviders, useSignInMethods } from '@/features/auth/api/google';
import { currentUserKey, useCurrentUser } from '@/features/auth/api/use-auth';
import { usePathname, useRouter } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { DeleteAccount, ExportDataButton } from './AccountDataSections';
import { GoogleAccountSection, SetPasswordByEmail } from './GoogleAccountSection';

/**
 * `/settings`: account details, password, linked Google account, data export and account deletion (root can
 * neither change its password nor delete itself — both are managed by config). Google flows come back here with
 * `?linked=google` or `?error=<code>`.
 */
export function SettingsView() {
  const t = useTranslations('settings');
  const tAdmin = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const { data: user, isPending } = useCurrentUser();
  const { data: providers } = useAuthProviders();
  const { data: methods } = useSignInMethods();
  const redirectError = useGoogleRedirectResult();

  if (isPending || !user) return <Skeleton className="h-96 w-full" />;
  // Until the methods load, assume a password (the common case) rather than flashing the Google-only variants.
  const hasPassword = methods?.hasPassword ?? true;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Heading level={1} size="lg">
        {t('title')}
      </Heading>
      {redirectError && <Alert tone="danger">{tErrors(redirectError)}</Alert>}
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
      <Section
        title={t(hasPassword ? 'password' : 'setPasswordTitle')}
        description={hasPassword ? t('passwordDescription') : undefined}
      >
        {!canManageOwnPassword(user) ? (
          <Alert tone="info">{t('rootPassword')}</Alert>
        ) : hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <SetPasswordByEmail email={user.email} />
        )}
      </Section>
      {providers?.google && canUseSignInProviders(user) && methods && (
        <Section title={t('google.title')} description={t('google.description')}>
          <GoogleAccountSection methods={methods} />
        </Section>
      )}
      <Section title={t('data.title')} description={t('data.description')}>
        <ExportDataButton />
      </Section>
      {canDeleteOwnAccount(user) && (
        <Section title={t('delete.sectionTitle')} description={t('delete.description')}>
          <DeleteAccount hasPassword={hasPassword} />
        </Section>
      )}
    </div>
  );
}

/**
 * @description Reads the result of a Google flow from the URL once: a toast for a new link, the error code for
 * a failure. The URL is then cleaned so a reload doesn't repeat them.
 * @returns The error code to show, if any.
 */
function useGoogleRedirectResult(): ErrorCode | null {
  const t = useTranslations('settings.google');
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linked = searchParams.get('linked') === 'google';
  const error = searchParams.get('error');

  useEffect(() => {
    if (!linked) return;
    toast.show({ tone: 'success', title: t('linked') });
    router.replace(pathname);
  }, [linked, pathname, router, t, toast]);

  return error && (Object.values(ErrorCode) as string[]).includes(error) ? (error as ErrorCode) : null;
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
