'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/atoms';
import { useToast } from '@/components/organisms';
import { useErrorText } from '@/lib/api/use-error-text';

import { authApi } from '../api/auth-api';

const COOLDOWN_SECONDS = 60;

/**
 * @description Resends the verification email, then disables itself for 60 s (the API also rate-limits).
 * @param props.email - Address to send to.
 * @param props.startWithCooldown - `true` right after registering, since an email was just sent.
 */
export function ResendVerificationButton({
  email,
  startWithCooldown = false,
}: {
  email: string;
  startWithCooldown?: boolean;
}) {
  const t = useTranslations('auth.resend');
  const toast = useToast();
  const errorText = useErrorText();
  const [secondsLeft, setSecondsLeft] = useState(startWithCooldown ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification({ email }),
    onSuccess: () => {
      toast.show({ tone: 'success', title: t('sent') });
      setSecondsLeft(COOLDOWN_SECONDS);
    },
    onError: (error) => toast.show({ tone: 'danger', title: errorText(error) }),
  });

  return (
    <Button
      variant="outline"
      fullWidth
      loading={resend.isPending}
      disabled={secondsLeft > 0}
      onClick={() => resend.mutate()}
    >
      {secondsLeft > 0 ? t('cooldown', { seconds: secondsLeft }) : t('action')}
    </Button>
  );
}
