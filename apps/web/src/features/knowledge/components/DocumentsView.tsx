'use client';

import {
  type CreateTextDocumentInput,
  createTextDocumentSchema,
  KNOWLEDGE_FILE_TYPES,
  KNOWLEDGE_LIMITS,
  type KnowledgeDocument,
  type ResumeStatus,
} from '@offerleap/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge, Button, Heading, Icon, Input, Skeleton, Spinner, Text, Textarea } from '@/components/atoms';
import { Alert, FileDropzone, FormField } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';
import { cn } from '@/lib/cn';
import { applyServerFieldErrors, sharedSchemaResolver, useFieldErrorText } from '@/lib/forms/field-errors';

import {
  useCreateTextDocument,
  useDeleteDocument,
  useDocuments,
  useKnowledgeSearch,
  useUploadDocument,
} from '../api/use-knowledge';

const ACCEPT = [...Object.keys(KNOWLEDGE_FILE_TYPES), ...Object.values(KNOWLEDGE_FILE_TYPES), '.markdown'];
const STATUS_TONE: Record<ResumeStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
};

/** `/documents`: add personal documents for RAG, see their processing status, and try a semantic search. */
export function DocumentsView() {
  const t = useTranslations('documents');
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="lg">
          {t('title')}
        </Heading>
        <Text tone="muted" className="max-w-3xl">
          {t('description')}
        </Text>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title={t('add')} id="add-document">
          <AddDocument />
        </Card>
        <ListAndSearch />
      </div>
    </div>
  );
}

/**
 * @description The document list with the search below it, shown together once the list has loaded: the list's
 * height isn't known before, and the search card would move down when it arrives.
 */
function ListAndSearch() {
  const t = useTranslations('documents');
  const { isPending } = useDocuments();
  if (isPending) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <DocumentList />
      <Card title={t('search.title')} id="search-documents" description={t('search.description')}>
        <SearchDocuments />
      </Card>
    </div>
  );
}

function Card({
  title,
  id,
  description,
  children,
}: {
  title: string;
  id: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-semibold text-fg">
          {title}
        </h2>
        {description && (
          <Text size="sm" tone="muted">
            {description}
          </Text>
        )}
      </div>
      {children}
    </section>
  );
}

function AddDocument() {
  const t = useTranslations('documents');
  const tErrors = useTranslations('errors');
  const toast = useToast();
  const errorText = useErrorText();
  const fieldError = useFieldErrorText();
  const upload = useUploadDocument();
  const create = useCreateTextDocument();
  const [uploadError, setUploadError] = useState<string>();
  const form = useForm<CreateTextDocumentInput>({
    resolver: sharedSchemaResolver(createTextDocumentSchema),
    defaultValues: { title: '', content: '' },
  });
  const { errors } = form.formState;
  const added = () => toast.show({ tone: 'success', title: t('added') });
  const createError = create.error && !(isApiError(create.error) && create.error.fieldErrors.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {upload.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner size="sm" label={null} />
          {t('statuses.PROCESSING')}
        </p>
      ) : (
        <FileDropzone
          title={t('dropTitle')}
          hint={t('dropHint')}
          accept={ACCEPT}
          maxBytes={KNOWLEDGE_LIMITS.fileBytes}
          onFile={(file) => {
            setUploadError(undefined);
            upload.mutate(file, { onSuccess: added, onError: (error) => setUploadError(errorText(error)) });
          }}
          onReject={(reason) =>
            setUploadError(
              tErrors(reason === 'size' ? 'COMMON_FILE_TOO_LARGE' : 'COMMON_UNSUPPORTED_FILE_TYPE'),
            )
          }
          error={uploadError}
        />
      )}
      <div className="flex items-center gap-3 text-xs text-fg-muted uppercase">
        <span className="h-px flex-1 bg-border" />
        {t('orPaste')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          create.mutate(values, {
            onSuccess: () => {
              added();
              form.reset();
            },
            onError: (error) => {
              if (isApiError(error)) applyServerFieldErrors(error.fieldErrors, form.setError);
            },
          }),
        )}
      >
        {createError && <Alert tone="danger">{errorText(create.error)}</Alert>}
        <FormField label={t('titleLabel')} error={fieldError(errors.title)} required>
          {(field) => <Input {...field} {...form.register('title')} placeholder={t('titlePlaceholder')} />}
        </FormField>
        <FormField label={t('content')} error={fieldError(errors.content)} required>
          {(field) => (
            <Textarea
              {...field}
              {...form.register('content')}
              rows={7}
              placeholder={t('contentPlaceholder')}
            />
          )}
        </FormField>
        <Button type="submit" className="self-end" loading={create.isPending}>
          {t('save')}
        </Button>
      </form>
    </div>
  );
}

function DocumentList() {
  const t = useTranslations('documents');
  const errorText = useErrorText();
  const { data, error, isPending } = useDocuments();
  const [deleting, setDeleting] = useState<KnowledgeDocument | null>(null);

  return (
    <section aria-labelledby="document-list" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="document-list" className="font-semibold text-fg">
          {t('list')}
        </h2>
        {data && (
          <Text size="sm" tone="muted">
            {t('limit', { count: data.length, max: KNOWLEDGE_LIMITS.documentsPerUser })}
          </Text>
        )}
      </div>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : data?.length === 0 ? (
        <Text tone="muted">{t('empty')}</Text>
      ) : (
        <ul className="flex flex-col gap-3">
          {data?.map((document) => (
            <DocumentItem key={document.id} document={document} onDelete={() => setDeleting(document)} />
          ))}
        </ul>
      )}
      <DeleteDialog document={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

function DocumentItem({ document, onDelete }: { document: KnowledgeDocument; onDelete: () => void }) {
  const t = useTranslations('documents');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon name={document.source === 'TEXT' ? 'file-text' : 'book'} size="sm" className="text-fg-muted" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-fg">{document.title}</span>
          <span className="truncate text-xs text-fg-muted">
            {document.fileName ?? t('pasted')}
            {document.status === 'COMPLETED' &&
              ` · ${t('meta', { chunks: document.chunkCount, chars: format.number(document.charCount) })}`}
          </span>
        </div>
        <Badge tone={STATUS_TONE[document.status]}>{t(`statuses.${document.status}`)}</Badge>
        <Button variant="ghost" size="sm" aria-label={`${t('delete')} ${document.title}`} onClick={onDelete}>
          {t('delete')}
        </Button>
      </div>
      {document.status === 'FAILED' && document.errorCode && (
        <Text size="xs" tone="danger">
          {tErrors.has(document.errorCode) ? tErrors(document.errorCode) : tErrors('COMMON_INTERNAL_ERROR')}
        </Text>
      )}
    </li>
  );
}

function DeleteDialog({ document, onClose }: { document: KnowledgeDocument | null; onClose: () => void }) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const errorText = useErrorText();
  const remove = useDeleteDocument();
  return (
    <Dialog
      open={document !== null}
      onClose={onClose}
      title={document ? t('deleteTitle', { title: document.title }) : ''}
      description={t('deleteBody')}
      closeLabel={tCommon('close')}
      error={remove.error && remove.variables === document?.id ? errorText(remove.error) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              document &&
              remove.mutate(document.id, {
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

function SearchDocuments() {
  const t = useTranslations('documents.search');
  const format = useFormatter();
  const errorText = useErrorText();
  const [text, setText] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const { data, error, isFetching } = useKnowledgeSearch(query);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length >= 2) setQuery(text.trim());
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <Input
          type="search"
          aria-label={t('label')}
          placeholder={t('placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="outline" loading={isFetching}>
          {t('submit')}
        </Button>
      </form>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {data && (
        <div role="status" aria-busy={isFetching}>
          {data.length === 0 ? (
            <Text tone="muted">{t('empty')}</Text>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.map((match, index) => (
                <li
                  key={`${match.documentId}-${index}`}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg bg-surface-muted/60 p-3',
                    // Below the threshold: shown for transparency, but the AI would not get it.
                    !match.relevant && 'opacity-60',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{match.title}</span>
                    <span className="flex gap-1">
                      {!match.relevant && <Badge>{t('belowFloor')}</Badge>}
                      <Badge tone={match.relevant ? 'ai' : 'neutral'}>
                        {t('score', { score: format.number(match.score, { maximumFractionDigits: 2 }) })}
                      </Badge>
                    </span>
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-fg-muted">{match.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
