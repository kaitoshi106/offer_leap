'use client';

import { passwordSchema, ValidationRule } from '@offerleap/shared';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { Link, useRouter } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { authApi } from '../api/auth-api';

/** Web-only: the confirmation field never leaves the browser. */
const resetFormSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    error: ValidationRule.PASSWORDS_MISMATCH,
    path: ['confirmPassword'],
  });

/**
 * @description Sets a new password from `?token=`. Every session is signed out by the API, so the user is sent to
 * the sign-in page afterwards.
 */
export function ResetPasswordForm() {
  const t = useTranslations();
  const fieldError = useFieldErrorText();
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const token = useSearchParams().get('token');
  const form = useForm({
    resolver: sharedSchemaResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const reset = useMutation({
    mutationFn: (password: string) => authApi.resetPassword({ token: token ?? '', password }),
    onSuccess: () => {
      toast.show({ tone: 'success', title: t('auth.reset.success') });
      router.replace('/login');
    },
    onError: (error) => {
      if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
    },
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t('auth.reset.missingToken')}</Alert>
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          {t('auth.reset.requestNew')}
        </Link>
      </div>
    );
  }

  const { errors } = form.formState;
  const passwordProps = { showLabel: t('common.showPassword'), hideLabel: t('common.hidePassword') };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => reset.mutate(values.password))}
      className="flex flex-col gap-4"
    >
      {reset.error && (
        <Alert tone="danger">
          {errorText(reset.error)}{' '}
          <Link href="/forgot-password" className="font-medium underline">
            {t('auth.reset.requestNew')}
          </Link>
        </Alert>
      )}
      <FormField
        label={t('auth.fields.newPassword')}
        hint={t('auth.fields.passwordHint')}
        error={fieldError(errors.password)}
        required
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...form.register('password')}
            autoComplete="new-password"
            {...passwordProps}
          />
        )}
      </FormField>
      <FormField label={t('auth.fields.confirmPassword')} error={fieldError(errors.confirmPassword)} required>
        {(field) => (
          <PasswordInput
            {...field}
            {...form.register('confirmPassword')}
            autoComplete="new-password"
            {...passwordProps}
          />
        )}
      </FormField>
      <Button type="submit" fullWidth size="lg" loading={reset.isPending}>
        {t('auth.reset.submit')}
      </Button>
    </form>
  );
}
