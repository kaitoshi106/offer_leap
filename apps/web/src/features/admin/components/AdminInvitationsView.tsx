'use client';

import {
  type AdminInvitation,
  type InvitationStatus,
  type InviteAdminInput,
  inviteAdminSchema,
  LOCALES,
} from '@offerleap/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Badge, Button, Input, Select, Skeleton, Text } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import { useInvitations, useInviteAdmin, useResendInvitation, useRevokeInvitation } from '../api/use-admin';

const STATUS_TONE: Record<InvitationStatus, 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'danger',
};

/** Root only: invite general admins by email and manage the invitations. */
export function AdminInvitationsView() {
  const t = useTranslations('admin.admins');
  const errorText = useErrorText();
  const { data, error, isPending } = useInvitations();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section
        aria-labelledby="invite-admin"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <div className="flex flex-col gap-1">
          <h2 id="invite-admin" className="font-semibold text-fg">
            {t('inviteTitle')}
          </h2>
          <Text size="sm" tone="muted">
            {t('description')}
          </Text>
        </div>
        <InviteForm />
      </section>

      <section aria-labelledby="invitation-list" className="flex flex-col gap-3">
        <h2 id="invitation-list" className="font-semibold text-fg">
          {t('list')}
        </h2>
        {error && <Alert tone="danger">{errorText(error)}</Alert>}
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : data?.length === 0 ? (
          <Text tone="muted">{t('empty')}</Text>
        ) : (
          <ul className="flex flex-col gap-3">
            {data?.map((invitation) => (
              <InvitationItem key={invitation.id} invitation={invitation} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InviteForm() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const invite = useInviteAdmin();
  const form = useForm<InviteAdminInput>({
    resolver: sharedSchemaResolver(inviteAdminSchema),
    defaultValues: { email: '', locale },
  });
  const { errors } = form.formState;
  const generalError = invite.error && !(isApiError(invite.error) && invite.error.fieldErrors.length > 0);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        invite.mutate(values, {
          onSuccess: (invitation) => {
            toast.show({ tone: 'success', title: t('admins.invited', { email: invitation.email }) });
            form.reset({ email: '', locale: values.locale });
          },
          onError: (error) => {
            if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
          },
        }),
      )}
    >
      {generalError && <Alert tone="danger">{errorText(invite.error)}</Alert>}
      <FormField label={t('admins.email')} error={fieldError(errors.email)} required>
        {(field) => <Input {...field} {...form.register('email')} type="email" autoComplete="off" />}
      </FormField>
      <FormField label={t('admins.language')}>
        {(field) => (
          <Select {...field} {...form.register('locale')}>
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {t(`languages.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <Button type="submit" className="self-end" loading={invite.isPending}>
        {t('admins.invite')}
      </Button>
    </form>
  );
}

function InvitationItem({ invitation }: { invitation: AdminInvitation }) {
  const t = useTranslations('admin.admins');
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const errorText = useErrorText();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  const open = invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
  const onError = (error: unknown) => toast.show({ tone: 'danger', title: errorText(error) });

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-fg">{invitation.email}</span>
        <span className="text-xs text-fg-muted">
          {t('invitedBy', { name: invitation.invitedBy, date: date(invitation.createdAt) })}
          {invitation.status === 'PENDING' && ` · ${t('expires', { date: date(invitation.expiresAt) })}`}
        </span>
      </div>
      <Badge tone={STATUS_TONE[invitation.status]}>{t(`statuses.${invitation.status}`)}</Badge>
      {open && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={resend.isPending}
            onClick={() =>
              resend.mutate(
                { id: invitation.id, locale },
                { onSuccess: () => toast.show({ tone: 'success', title: t('resent') }), onError },
              )
            }
          >
            {t('resend')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={revoke.isPending}
            onClick={() =>
              revoke.mutate(invitation.id, {
                onSuccess: () => toast.show({ tone: 'success', title: t('revoked') }),
                onError,
              })
            }
          >
            {t('revoke')}
          </Button>
        </div>
      )}
    </li>
  );
}
