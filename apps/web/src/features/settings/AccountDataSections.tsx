'use client';

import { type DeleteAccountInput, deleteAccountSchema, ErrorCode, type Locale } from '@offerleap/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/atoms';
import { Alert, FormField, PasswordInput } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { accountApi } from '@/features/account/api/account-api';
import { startGoogleAccountFlow } from '@/features/auth/api/google';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { useAuthRedirect } from '@/lib/auth-redirect';
import { sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

/**
 * @description Saves the export as a file. The API answers JSON through the usual client (cookies, refresh), so
 * the browser download is made from a Blob rather than a plain link.
 */
function saveJson(data: { exportedAt: string }) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `offerleap-export-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** "Download my data": one JSON file with everything the user created. */
export function ExportDataButton() {
  const t = useTranslations('settings.data');
  const toast = useToast();
  const errorText = useErrorText();
  const exportData = useMutation({
    mutationFn: accountApi.export,
    onSuccess: (data) => {
      saveJson(data);
      toast.show({ tone: 'success', title: t('exported') });
    },
    onError: (error) => toast.show({ tone: 'danger', title: errorText(error) }),
  });
  return (
    <Button
      variant="outline"
      className="self-start"
      loading={exportData.isPending}
      onClick={() => exportData.mutate()}
    >
      {t('export')}
    </Button>
  );
}

/**
 * @description "Delete account" with a confirmation dialog that asks for the password. On success the API has
 * cleared the session cookies; a full page load to the login page drops every cached query of the old account.
 * Accounts without a password (created with Google) confirm with a fresh Google sign-in instead.
 */
export function DeleteAccount({ hasPassword = true }: { hasPassword?: boolean }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const redirect = useAuthRedirect();
  const formId = useId();
  const locale = useLocale() as Locale;
  const google = useMutation({ mutationFn: () => startGoogleAccountFlow('delete', locale) });
  const [open, setOpen] = useState(false);
  const form = useForm<DeleteAccountInput>({
    resolver: sharedSchemaResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });
  const remove = useMutation({
    mutationFn: accountApi.remove,
    onSuccess: () => redirect('/login?deleted=1'),
    onError: (error) => {
      if (isApiError(error) && error.code === ErrorCode.AUTH_INVALID_CREDENTIALS) {
        form.setError('password', { message: t('settings.delete.wrongPassword') }, { shouldFocus: true });
      }
    },
  });
  const close = () => {
    setOpen(false);
    form.reset();
    remove.reset();
    google.reset();
  };
  const generalError =
    remove.error && !(isApiError(remove.error) && remove.error.code === ErrorCode.AUTH_INVALID_CREDENTIALS);

  return (
    <>
      <Button variant="danger" className="self-start" onClick={() => setOpen(true)}>
        {t('settings.delete.open')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t('settings.delete.title')}
        description={t(hasPassword ? 'settings.delete.body' : 'settings.delete.googleBody')}
        closeLabel={t('common.close')}
        error={google.error ? errorText(google.error) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {t('settings.delete.cancel')}
            </Button>
            {hasPassword ? (
              <Button type="submit" form={formId} variant="danger" loading={remove.isPending}>
                {t('settings.delete.confirm')}
              </Button>
            ) : (
              <Button variant="danger" loading={google.isPending} onClick={() => google.mutate()}>
                {t('settings.delete.confirmGoogle')}
              </Button>
            )}
          </>
        }
      >
        {/* Mounted only while open, so the password field never sits hidden in the page. */}
        {open && hasPassword && (
          <form
            id={formId}
            noValidate
            onSubmit={form.handleSubmit((values) => remove.mutate(values))}
            className="flex flex-col gap-4"
          >
            {generalError && <Alert tone="danger">{errorText(remove.error)}</Alert>}
            <FormField
              label={t('settings.currentPassword')}
              error={fieldError(form.formState.errors.password)}
              required
            >
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
          </form>
        )}
      </Dialog>
    </>
  );
}
