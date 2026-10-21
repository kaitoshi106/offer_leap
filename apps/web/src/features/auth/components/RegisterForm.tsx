'use client';

import { type RegisterInput, registerSchema } from '@offerleap/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { authApi } from '../api/auth-api';
import { GoogleSignIn } from './GoogleSignIn';
import { ResendVerificationButton } from './ResendVerificationButton';

/**
 * @description Sign-up form. On success it swaps to a "check your inbox" panel with a resend button; the account
 * can't sign in before the email is verified.
 */
export function RegisterForm() {
  const t = useTranslations();
  const fieldError = useFieldErrorText();
  const locale = useLocale();
  const errorText = useErrorText();
  const form = useForm({
    resolver: sharedSchemaResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const register = useMutation({
    mutationFn: (values: RegisterInput) => authApi.register({ ...values, locale }),
    onError: (error) => {
      if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
    },
  });

  if (register.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title={t('auth.register.checkEmailTitle')}>
          {t('auth.register.checkEmailBody', { email: register.data.email })}
        </Alert>
        <ResendVerificationButton email={register.data.email} startWithCooldown />
      </div>
    );
  }

  const { errors } = form.formState;
  const generalError =
    register.error && !(isApiError(register.error) && register.error.fieldErrors.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignIn />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
        className="flex flex-col gap-4"
      >
        {generalError && <Alert tone="danger">{errorText(register.error)}</Alert>}

        <FormField label={t('auth.fields.fullName')} error={fieldError(errors.fullName)} required>
          {(field) => <Input {...field} {...form.register('fullName')} autoComplete="name" />}
        </FormField>

        <FormField label={t('auth.fields.email')} error={fieldError(errors.email)} required>
          {(field) => (
            <Input
              {...field}
              {...form.register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
            />
          )}
        </FormField>

        <FormField
          label={t('auth.fields.password')}
          hint={t('auth.fields.passwordHint')}
          error={fieldError(errors.password)}
          required
        >
          {(field) => (
            <PasswordInput
              {...field}
              {...form.register('password')}
              autoComplete="new-password"
              showLabel={t('common.showPassword')}
              hideLabel={t('common.hidePassword')}
            />
          )}
        </FormField>

        <Button type="submit" fullWidth size="lg" loading={register.isPending}>
          {t('auth.register.submit')}
        </Button>
      </form>
    </div>
  );
}
