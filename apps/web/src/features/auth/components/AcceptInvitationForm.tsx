'use client';

import { acceptInvitationSchema } from '@offerleap/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';

import { Button, Input, Skeleton } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { authApi } from '../api/auth-api';

/** What the invitee fills in; the token comes from the link. */
const formSchema = acceptInvitationSchema.omit({ token: true });

/**
 * @description Set-up page for an invited general admin (`?token=` from the email). Shows the invited email
 * first (checking the link), then creates the account and opens the admin console signed in.
 */
export function AcceptInvitationForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const redirect = useAuthRedirect();
  const token = useSearchParams().get('token');

  const preview = useQuery({
    queryKey: ['admin-invitation', token],
    queryFn: () => authApi.previewInvitation(token!),
    enabled: Boolean(token),
    retry: false,
  });
  const form = useForm({
    resolver: sharedSchemaResolver(formSchema),
    defaultValues: { fullName: '', password: '' },
  });
  const accept = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) =>
      authApi.acceptInvitation({ ...values, token: token! }),
    // Full page load: the new session cookies must be used from the first request.
    onSuccess: () => redirect('/admin/users'),
    onError: (error) => {
      if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
    },
  });

  if (!token) return <Alert tone="danger">{t('auth.invite.missingToken')}</Alert>;
  if (preview.isPending) {
    return (
      <div role="status" aria-label={t('auth.invite.checking')} className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (preview.error) {
    return (
      <Alert tone="danger">
        {errorText(preview.error)} {t('auth.invite.askRoot')}
      </Alert>
    );
  }

  const { errors } = form.formState;
  const generalError = accept.error && !(isApiError(accept.error) && accept.error.fieldErrors.length > 0);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => accept.mutate(values))}
      className="flex flex-col gap-4"
    >
      {generalError && <Alert tone="danger">{errorText(accept.error)}</Alert>}
      <FormField label={t('auth.invite.email')}>
        {(field) => <Input {...field} value={preview.data.email} readOnly autoComplete="username" />}
      </FormField>
      <FormField label={t('auth.fields.fullName')} error={fieldError(errors.fullName)} required>
        {(field) => <Input {...field} {...form.register('fullName')} autoComplete="name" />}
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
      <Button type="submit" fullWidth size="lg" loading={accept.isPending}>
        {t('auth.invite.submit')}
      </Button>
    </form>
  );
}
