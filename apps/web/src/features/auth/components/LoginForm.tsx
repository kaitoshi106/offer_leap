'use client';

import { ErrorCode, type LoginInput, loginSchema } from '@offerleap/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { Link } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';
import { safeRedirectPath } from '@/lib/safe-redirect';

import { authApi } from '../api/auth-api';
import { currentUserKey } from '../api/use-auth';
import { ResendVerificationButton } from './ResendVerificationButton';

/**
 * @description Sign-in form. Redirects to `?next=` (same-site paths only) or the dashboard. An unverified account
 * gets a resend button instead of a dead end.
 */
export function LoginForm() {
  const t = useTranslations();
  const fieldError = useFieldErrorText();
  const errorText = useErrorText();
  const redirect = useAuthRedirect();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: sharedSchemaResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (values: LoginInput) => authApi.login(values),
    onSuccess: (session) => {
      queryClient.setQueryData(currentUserKey, session.user);
      const unfinished = session.user.role === 'USER' && !session.user.onboardingCompleted;
      redirect(safeRedirectPath(searchParams.get('next'), unfinished ? '/onboarding' : '/dashboard'));
    },
  });

  const notVerified = isApiError(login.error) && login.error.code === ErrorCode.AUTH_EMAIL_NOT_VERIFIED;
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
      className="flex flex-col gap-4"
    >
      {notVerified ? (
        <div className="flex flex-col gap-3">
          <Alert tone="warning">{t('auth.login.notVerified', { email: login.variables?.email ?? '' })}</Alert>
          <ResendVerificationButton email={login.variables?.email ?? ''} />
        </div>
      ) : (
        login.error && <Alert tone="danger">{errorText(login.error)}</Alert>
      )}

      <FormField label={t('auth.fields.email')} error={fieldError(errors.email)} required>
        {(field) => (
          <Input
            {...field}
            {...form.register('email')}
            type="email"
            autoComplete="username"
            inputMode="email"
          />
        )}
      </FormField>

      <FormField label={t('auth.fields.password')} error={fieldError(errors.password)} required>
        {(field) => (
          <PasswordInput
            {...field}
            {...form.register('password')}
            autoComplete="current-password"
            showLabel={t('common.showPassword')}
            hideLabel={t('common.hidePassword')}
          />
        )}
      </FormField>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary-text hover:underline">
          {t('auth.login.forgot')}
        </Link>
      </div>

      <Button type="submit" fullWidth size="lg" loading={login.isPending}>
        {t('auth.login.submit')}
      </Button>
    </form>
  );
}
