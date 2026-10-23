'use client';

import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Skeleton, Text, VisuallyHidden } from '@/components/atoms';
import { Alert } from '@/components/molecules';
import { useToast } from '@/components/organisms';
import { useErrorText } from '@/lib/api/use-error-text';
import { cn } from '@/lib/cn';

import { useApplications, useMoveApplication } from '../api/use-applications';
import { dropBeforeId, dropPosition, toColumns } from '../board';
import { usePointerDrag } from '../use-pointer-drag';
import { ApplicationCard } from './ApplicationCard';

const COLUMN_ACCENT: Record<ApplicationStatus, string> = {
  SAVED: 'bg-fg-subtle',
  APPLIED: 'bg-primary',
  INTERVIEW: 'bg-ai',
  OFFER: 'bg-success',
  REJECTED: 'bg-danger',
};

/**
 * @description Kanban board of applications. Cards move by drag and drop (Pointer Events, no library: a full
 * copy of the card follows the pointer) or with the column select on each card; every move is announced to
 * screen readers.
 */
export function ApplicationBoard() {
  const t = useTranslations('applications');
  const errorText = useErrorText();
  const toast = useToast();
  const { data, error, isPending } = useApplications();
  const move = useMoveApplication();
  const [announcement, setAnnouncement] = useState('');
  const columns = useMemo(() => toColumns(data ?? []), [data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreToTheRight = useMoreToTheRight(scrollRef, Boolean(data));
  // Destructured: `overlayRef` is a ref, the rest is plain state and functions.
  const { active, target, overlayRef, dragHandleProps } = usePointerDrag<ApplicationStatus>({
    scrollRef,
    resolveTarget: (column, hovered, draggedId) => ({
      column,
      beforeId:
        hovered &&
        dropBeforeId(
          columns[column].map((card) => card.id),
          hovered.id,
          hovered.lowerHalf,
          draggedId,
        ),
    }),
    onDrop: (id, target) => {
      const card = data?.find((application) => application.id === id);
      if (card) moveCard(card, target.column, target.beforeId);
    },
  });
  const dragged = active && data?.find((application) => application.id === active.id);

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
    // Announced as it happens on screen (optimistic); a refused move goes back, and that is said too.
    setAnnouncement(t('moved', { jobTitle: card.jobTitle, status: t(`statuses.${status}`) }));
    move.mutate(
      { id: card.id, status, position },
      {
        onError: (moveError) => {
          setAnnouncement(t('moveFailed', { jobTitle: card.jobTitle, status: t(`statuses.${card.status}`) }));
          toast.show({ tone: 'danger', title: errorText(moveError) });
        },
      },
    );
  }

  return (
    <>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <div className="relative">
        {moreToTheRight && (
          // Below xl not every column fits: a fade on the right edge says there is more to scroll to.
          <div
            data-scroll-hint
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -right-4 z-[1] w-12 bg-linear-to-l from-bg to-transparent sm:-right-6 xl:hidden"
          />
        )}
        <div
          ref={scrollRef}
          data-board-scroll
          className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0"
        >
          {APPLICATION_STATUSES.map((status) => {
            const cards = columns[status];
            const headingId = `column-${status}`;
            return (
              <section
                key={status}
                aria-labelledby={headingId}
                data-drop-column={status}
                className={cn(
                  'flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border border-transparent bg-surface-muted/60 p-3 transition-colors xl:w-auto',
                  target?.column === status && !target.beforeId && 'border-primary bg-primary-soft/40',
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
                      dragProps={dragHandleProps(card.id)}
                      dragging={active?.id === card.id}
                      dragActive={Boolean(active)}
                      dropIndicator={target?.beforeId === card.id && active?.id !== card.id}
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
      </div>
      {dragged &&
        createPortal(
          // The copy under the pointer: hidden from assistive tech (the move is announced on drop) and inert.
          <div
            ref={overlayRef}
            aria-hidden
            inert
            data-drag-overlay
            className="pointer-events-none fixed top-0 left-0 z-50"
            style={{ width: active.width }}
          >
            <ul className="motion-safe:animate-lift">
              <ApplicationCard application={dragged} overlay />
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * @description Whether a horizontally scrolling element has more content to the right (not scrolled to its end).
 * @param ref - The scrolling element.
 * @param ready - Whether it is rendered yet.
 */
function useMoreToTheRight(ref: RefObject<HTMLElement | null>, ready: boolean): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!ready || !element) return;
    const update = () => setMore(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    update();
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      element.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ref, ready]);
  return more;
}
