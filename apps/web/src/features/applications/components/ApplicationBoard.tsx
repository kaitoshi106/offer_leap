'use client';

import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { type DragEvent, useMemo, useState } from 'react';

import { Skeleton, Text, VisuallyHidden } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { useErrorText } from '@/lib/api/use-error-text';
import { cn } from '@/lib/cn';

import { useApplications, useMoveApplication } from '../api/use-applications';
import { dropPosition, toColumns } from '../board';
import { ApplicationCard } from './ApplicationCard';

const COLUMN_ACCENT: Record<ApplicationStatus, string> = {
  SAVED: 'bg-fg-subtle',
  APPLIED: 'bg-primary',
  INTERVIEW: 'bg-ai',
  OFFER: 'bg-success',
  REJECTED: 'bg-danger',
};

interface DropTarget {
  status: ApplicationStatus;
  beforeId?: string;
}

/**
 * @description Kanban board of applications. Cards move by drag and drop (HTML5 DnD, no library) or with the
 * column select on each card; every move is announced to screen readers.
 */
export function ApplicationBoard() {
  const t = useTranslations('applications');
  const errorText = useErrorText();
  const { data, error, isPending } = useApplications();
  const move = useMoveApplication();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const columns = useMemo(() => toColumns(data ?? []), [data]);

  if (error) return <Alert tone="danger">{errorText(error)}</Alert>;
  if (isPending) {
    return (
      <div aria-busy className="flex gap-4 overflow-hidden">
        {APPLICATION_STATUSES.map((status) => (
          <Skeleton key={status} className="h-64 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  function moveCard(card: ApplicationSummary, status: ApplicationStatus, beforeId?: string) {
    if (card.id === beforeId) return;
    const position = dropPosition(columns[status], card.id, beforeId);
    if (card.status === status && card.position === position) return;
    move.mutate({ id: card.id, status, position });
    setAnnouncement(t('moved', { jobTitle: card.jobTitle, status: t(`statuses.${status}`) }));
  }

  function allowDrop(event: DragEvent, next: DropTarget) {
    if (!draggedId) return;
    // Without preventDefault the browser refuses the drop.
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (target?.status !== next.status || target.beforeId !== next.beforeId) setTarget(next);
  }

  function drop(event: DragEvent, next: DropTarget) {
    event.preventDefault();
    event.stopPropagation();
    const card = data?.find((application) => application.id === draggedId);
    if (card) moveCard(card, next.status, next.beforeId);
    setDraggedId(null);
    setTarget(null);
  }

  return (
    <>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
        {APPLICATION_STATUSES.map((status) => {
          const cards = columns[status];
          const headingId = `column-${status}`;
          return (
            <section
              key={status}
              aria-labelledby={headingId}
              onDragOver={(event) => allowDrop(event, { status })}
              onDrop={(event) => drop(event, { status })}
              className={cn(
                'flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border border-transparent bg-surface-muted/60 p-3 transition-colors xl:w-auto',
                target?.status === status && !target.beforeId && 'border-primary bg-primary-soft/40',
              )}
            >
              <h2 id={headingId} className="flex items-center gap-2 px-1 text-sm font-semibold text-fg">
                <span aria-hidden className={cn('size-2 rounded-full', COLUMN_ACCENT[status])} />
                {t(`statuses.${status}`)}
                <span className="ml-auto rounded-full bg-surface px-2 text-xs text-fg-muted">
                  {cards.length}
                </span>
              </h2>
              <ul className="flex min-h-24 flex-col gap-3">
                {cards.map((card) => (
                  <ApplicationCard
                    key={card.id}
                    application={card}
                    onMove={(next) => moveCard(card, next, columns[next][0]?.id)}
                    onDragStart={() => setDraggedId(card.id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setTarget(null);
                    }}
                    onDragOver={(event) => allowDrop(event, { status, beforeId: card.id })}
                    onDrop={(event) => drop(event, { status, beforeId: card.id })}
                    dragging={draggedId === card.id}
                    dropIndicator={target?.beforeId === card.id && draggedId !== card.id}
                  />
                ))}
                {cards.length === 0 && (
                  <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
                    <Text size="sm" tone="muted">
                      {t('empty')}
                    </Text>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
