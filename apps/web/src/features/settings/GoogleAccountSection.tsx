'use client';

import type { Locale, SignInMethods } from '@offerleap/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { Button, Text } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { authApi } from '@/features/auth/api/auth-api';
import { startGoogleAccountFlow, useUnlinkGoogle } from '@/features/auth/api/google';
import { useErrorText } from '@/lib/api/use-error-text';

/**
 * @description Linked Google account: link one (a Google flow for the signed-in user) or unlink it. Unlinking is
 * offered only when a password is set, so the account always keeps a way in.
 */
export function GoogleAccountSection({ methods }: { methods: SignInMethods }) {
  const t = useTranslations('settings.google');
  const locale = useLocale() as Locale;
  const toast = useToast();
  const errorText = useErrorText();
  const unlink = useUnlinkGoogle();
  const link = useMutation({ mutationFn: () => startGoogleAccountFlow('link', locale) });
  const google = methods.identities.find((identity) => identity.provider === 'GOOGLE');

  if (!google) {
    return (
      <Button variant="outline" className="self-start" loading={link.isPending} onClick={() => link.mutate()}>
        {t('link')}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Text size="sm">{t('linkedAs', { email: google.email })}</Text>
      {methods.hasPassword ? (
        <Button
          variant="outline"
          className="self-start"
          loading={unlink.isPending}
          onClick={() =>
            unlink.mutate(undefined, {
              onSuccess: () => toast.show({ tone: 'success', title: t('unlinked') }),
              onError: (error) => toast.show({ tone: 'danger', title: errorText(error) }),
            })
          }
        >
          {t('unlink')}
        </Button>
      ) : (
        <Alert tone="info">{t('onlyMethod')}</Alert>
      )}
    </div>
  );
}

/**
 * @description For accounts created with Google: no password to change, but one can be set through the usual
 * reset email (it proves the inbox, like the reset flow does).
 */
export function SetPasswordByEmail({ email }: { email: string }) {
  const t = useTranslations('settings');
  const toast = useToast();
  const errorText = useErrorText();
  const send = useMutation({
    mutationFn: () => authApi.forgotPassword({ email }),
    onSuccess: () => toast.show({ tone: 'success', title: t('setPasswordSent', { email }) }),
    onError: (error) => toast.show({ tone: 'danger', title: errorText(error) }),
  });
  return (
    <div className="flex flex-col gap-3">
      <Text size="sm" tone="muted">
        {t('noPassword')}
      </Text>
      <Button variant="outline" className="self-start" loading={send.isPending} onClick={() => send.mutate()}>
        {t('setPassword')}
      </Button>
    </div>
  );
}
