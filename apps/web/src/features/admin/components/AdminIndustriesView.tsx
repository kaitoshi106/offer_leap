'use client';

import {
  type AdminIndustry,
  type CreateIndustryInput,
  createIndustrySchema,
  type UpdateIndustryInput,
  updateIndustrySchema,
} from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Skeleton, Text } from '@/components/atoms';
import { Alert, FormField } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import {
  useAdminIndustries,
  useCreateIndustry,
  useRemoveIndustry,
  useUpdateIndustry,
} from '../api/use-admin';

/** Admin: industry taxonomy — add, rename, delete when unused. */
export function AdminIndustriesView() {
  const t = useTranslations('admin.industries');
  const errorText = useErrorText();
  const { data, error, isPending } = useAdminIndustries();
  const [editing, setEditing] = useState<AdminIndustry | null>(null);
  const [deleting, setDeleting] = useState<AdminIndustry | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section
        aria-labelledby="add-industry"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <div className="flex flex-col gap-1">
          <h2 id="add-industry" className="font-semibold text-fg">
            {t('add')}
          </h2>
          <Text size="sm" tone="muted">
            {t('description')}
          </Text>
        </div>
        <CreateForm />
      </section>

      <section aria-labelledby="industry-list" className="flex flex-col gap-3">
        <h2 id="industry-list" className="font-semibold text-fg">
          {t('title')}
        </h2>
        {error && <Alert tone="danger">{errorText(error)}</Alert>}
        {isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs text-fg-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('nameVi')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('code')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('profiles')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t('edit')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.map((industry) => (
                  <tr key={industry.code}>
                    <th scope="row" className="px-4 py-3 font-medium text-fg">
                      {industry.nameVi}
                      <span className="block text-xs font-normal text-fg-muted">{industry.nameEn}</span>
                    </th>
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">{industry.code}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{industry.profileCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${t('edit')} ${industry.nameVi}`}
                          onClick={() => setEditing(industry)}
                        >
                          {t('edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={industry.profileCount > 0}
                          title={
                            industry.profileCount > 0
                              ? t('inUse', { count: industry.profileCount })
                              : undefined
                          }
                          aria-label={`${t('delete')} ${industry.nameVi}`}
                          onClick={() => setDeleting(industry)}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditDialog industry={editing} onClose={() => setEditing(null)} />
      <DeleteDialog industry={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function CreateForm() {
  const t = useTranslations('admin.industries');
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const create = useCreateIndustry();
  const form = useForm<CreateIndustryInput>({
    resolver: sharedSchemaResolver(createIndustrySchema),
    defaultValues: { code: '', nameVi: '', nameEn: '' },
  });
  const { errors } = form.formState;
  const generalError = create.error && !(isApiError(create.error) && create.error.fieldErrors.length > 0);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        create.mutate(values, {
          onSuccess: () => {
            toast.show({ tone: 'success', title: t('added') });
            form.reset();
          },
          onError: (error) => {
            if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
          },
        }),
      )}
    >
      {generalError && <Alert tone="danger">{errorText(create.error)}</Alert>}
      <FormField label={t('code')} hint={t('codeHint')} error={fieldError(errors.code)} required>
        {(field) => <Input {...field} {...form.register('code')} autoComplete="off" spellCheck={false} />}
      </FormField>
      <FormField label={t('nameVi')} error={fieldError(errors.nameVi)} required>
        {(field) => <Input {...field} {...form.register('nameVi')} />}
      </FormField>
      <FormField label={t('nameEn')} error={fieldError(errors.nameEn)} required>
        {(field) => <Input {...field} {...form.register('nameEn')} lang="en" />}
      </FormField>
      <Button type="submit" className="self-end" loading={create.isPending}>
        {t('add')}
      </Button>
    </form>
  );
}

function EditDialog({ industry, onClose }: { industry: AdminIndustry | null; onClose: () => void }) {
  const t = useTranslations('admin.industries');
  const tCommon = useTranslations('common');
  return (
    <Dialog
      open={industry !== null}
      onClose={onClose}
      title={industry ? t('editTitle', { code: industry.code }) : ''}
      closeLabel={tCommon('close')}
    >
      {industry && <EditForm key={industry.code} industry={industry} onDone={onClose} />}
    </Dialog>
  );
}

function EditForm({ industry, onDone }: { industry: AdminIndustry; onDone: () => void }) {
  const t = useTranslations('admin.industries');
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const update = useUpdateIndustry();
  const form = useForm<UpdateIndustryInput>({
    resolver: sharedSchemaResolver(updateIndustrySchema),
    defaultValues: { nameVi: industry.nameVi, nameEn: industry.nameEn },
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        update.mutate(
          { code: industry.code, ...values },
          {
            onSuccess: () => {
              toast.show({ tone: 'success', title: t('saved') });
              onDone();
            },
          },
        ),
      )}
    >
      {update.error && <Alert tone="danger">{errorText(update.error)}</Alert>}
      <FormField label={t('nameVi')} error={fieldError(errors.nameVi)} required>
        {(field) => <Input {...field} {...form.register('nameVi')} />}
      </FormField>
      <FormField label={t('nameEn')} error={fieldError(errors.nameEn)} required>
        {(field) => <Input {...field} {...form.register('nameEn')} lang="en" />}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type="submit" loading={update.isPending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

function DeleteDialog({ industry, onClose }: { industry: AdminIndustry | null; onClose: () => void }) {
  const t = useTranslations('admin.industries');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const errorText = useErrorText();
  const remove = useRemoveIndustry();

  return (
    <Dialog
      open={industry !== null}
      onClose={onClose}
      title={industry ? t('deleteTitle', { name: industry.nameVi }) : ''}
      description={t('deleteBody')}
      closeLabel={tCommon('close')}
      error={remove.error && remove.variables === industry?.code ? errorText(remove.error) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              industry &&
              remove.mutate(industry.code, {
                onSuccess: () => {
                  toast.show({ tone: 'success', title: t('deleted') });
                  onClose();
                },
              })
            }
          >
            {t('delete')}
          </Button>
        </>
      }
    />
  );
}
