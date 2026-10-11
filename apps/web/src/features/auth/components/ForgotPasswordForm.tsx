'use client';

import { type EmailOnlyInput, emailOnlySchema } from '@offerleap/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { useErrorText } from '@/lib/api/use-error-text';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { authApi } from '../api/auth-api';

/**
 * @description Requests a reset link. The confirmation never says whether the email exists (the API answers the
 * same for every address).
 */
export function ForgotPasswordForm() {
  const t = useTranslations();
  const fieldError = useFieldErrorText();
  const errorText = useErrorText();
  const form = useForm({ resolver: sharedSchemaResolver(emailOnlySchema), defaultValues: { email: '' } });
  const request = useMutation({ mutationFn: (values: EmailOnlyInput) => authApi.forgotPassword(values) });

  if (request.isSuccess) {
    return (
      <Alert tone="success" title={t('auth.forgot.sentTitle')}>
        {t('auth.forgot.sentBody', { email: request.variables.email })}
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => request.mutate(values))}
      className="flex flex-col gap-4"
    >
      {request.error && <Alert tone="danger">{errorText(request.error)}</Alert>}
      <FormField label={t('auth.fields.email')} error={fieldError(form.formState.errors.email)} required>
        {(field) => <Input {...field} {...form.register('email')} type="email" autoComplete="email" />}
      </FormField>
      <Button type="submit" fullWidth size="lg" loading={request.isPending}>
        {t('auth.forgot.submit')}
      </Button>
    </form>
  );
}
