'use client';

import { type EmailOnlyInput, emailOnlySchema } from '@offerleap/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Spinner } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { authApi } from '../api/auth-api';
import { currentUserKey } from '../api/use-auth';

/**
 * @description Consumes `?token=` once on load. Success signs the user in and opens the dashboard; an invalid or
 * expired link offers a fresh one.
 */
export function VerifyEmail() {
  const t = useTranslations();
  const errorText = useErrorText();
  const redirect = useAuthRedirect();
  const queryClient = useQueryClient();
  const token = useSearchParams().get('token');
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (session) => {
      queryClient.setQueryData(currentUserKey, session.user);
      // A freshly verified account still has to complete its profile.
      redirect('/onboarding');
    },
  });

  useEffect(() => {
    // Tokens are single-use: StrictMode runs effects twice in development, so guard against a second call.
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  if (token && (verify.isPending || verify.isIdle || verify.isSuccess)) {
    return (
      <div className="flex items-center gap-3 text-fg-muted">
        <Spinner label={null} />
        {t('auth.verify.verifying')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="danger">{verify.error ? errorText(verify.error) : t('auth.verify.missingToken')}</Alert>
      <RequestNewLink />
    </div>
  );
}

/** Email field + resend button shown when a verification link is unusable. */
function RequestNewLink() {
  const t = useTranslations();
  const fieldError = useFieldErrorText();
  const errorText = useErrorText();
  const form = useForm({ resolver: sharedSchemaResolver(emailOnlySchema), defaultValues: { email: '' } });
  const resend = useMutation({ mutationFn: (values: EmailOnlyInput) => authApi.resendVerification(values) });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => resend.mutate(values))}
      className="flex flex-col gap-3"
    >
      {resend.isSuccess && <Alert tone="success">{t('auth.resend.sent')}</Alert>}
      {resend.error && <Alert tone="danger">{errorText(resend.error)}</Alert>}
      <FormField
        label={t('auth.fields.email')}
        hint={t('auth.verify.requestNew')}
        error={fieldError(form.formState.errors.email)}
        required
      >
        {(field) => <Input {...field} {...form.register('email')} type="email" autoComplete="email" />}
      </FormField>
      <Button type="submit" variant="outline" fullWidth loading={resend.isPending}>
        {t('auth.resend.action')}
      </Button>
    </form>
  );
}
