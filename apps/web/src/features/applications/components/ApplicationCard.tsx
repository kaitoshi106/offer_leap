'use client';

import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import type { HTMLAttributes } from 'react';

import { Badge, Icon, Select } from '@/components/atoms';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

import { scoreBand } from '../../analyses/components/match';

export interface ApplicationCardProps {
  application: ApplicationSummary;
  /** Keyboard / touch alternative to dragging. */
  onMove?: (status: ApplicationStatus) => void;
  /** Pointer drag handlers and `data-drag-id` (see `usePointerDrag`). */
  dragProps?: HTMLAttributes<HTMLLIElement> & { 'data-drag-id': string };
  /** This card is being dragged: it stays in place, faded, while its copy follows the pointer. */
  dragging?: boolean;
  /** A dragged card would land above this one. */
  dropIndicator?: boolean;
  /** The floating copy under the pointer: same look, lifted, not interactive. */
  overlay?: boolean;
  /** Some card is being dragged: no hover highlight on the cards it passes over. */
  dragActive?: boolean;
}

/**
 * @description Kanban card. Draggable with a mouse, pen or finger (hold briefly); the column `<select>` does the
 * same for keyboard and screen-reader users.
 * @param props - {@link ApplicationCardProps}
 */
export function ApplicationCard({
  application,
  onMove,
  dragProps,
  dragging,
  dropIndicator,
  overlay,
  dragActive,
}: ApplicationCardProps) {
  const t = useTranslations('applications');
  const names = { jobTitle: application.jobTitle, company: application.company };

  return (
    <li
      {...dragProps}
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition',
        // No text selection or iOS link menu while holding a card to drag it.
        'cursor-grab select-none [-webkit-touch-callout:none]',
        !dragActive && 'hover:border-primary',
        'has-focus-visible:border-primary',
        dragging && 'border-dashed opacity-40',
        overlay && 'cursor-grabbing border-primary shadow-popover',
        dropIndicator &&
          'before:absolute before:inset-x-0 before:-top-2 before:h-0.5 before:rounded-full before:bg-primary',
      )}
    >
      {/* Drag handle: on touch screens dragging starts here at once (no hold), since `touch-none` keeps the
          browser from treating the gesture as a scroll. Pointer-only: keyboards use the column select. */}
      <span
        data-drag-handle
        aria-hidden
        className="absolute top-2 right-2 z-1 flex size-8 touch-none items-center justify-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg"
      >
        <Icon name="grip-vertical" size="sm" />
      </span>
      <div className="flex flex-col gap-0.5 pr-8">
        <Link
          href={`/applications/${application.id}`}
          draggable={false}
          aria-label={t('card.open', names)}
          className={cn(
            'font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-lg',
            !dragActive && 'hover:text-primary-text',
          )}
        >
          {application.jobTitle}
        </Link>
        <span className="text-sm text-fg-muted">{application.company}</span>
      </div>
      {(application.score !== null || application.hasCoverLetter) && (
        <div className="flex flex-wrap items-center gap-2">
          {application.score !== null && (
            <Badge tone={scoreBand(application.score).tone}>
              {t('card.score', { score: application.score })}
            </Badge>
          )}
          {application.hasCoverLetter && (
            <Badge tone="ai" icon={<Icon name="file-text" size="xs" />}>
              {t('card.coverLetter')}
            </Badge>
          )}
        </div>
      )}
      {/* Above the stretched link so it stays clickable. */}
      <Select
        aria-label={t('card.moveTo', names)}
        value={application.status}
        onChange={(event) => onMove?.(event.target.value as ApplicationStatus)}
        className="relative z-1 h-8 text-xs"
      >
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`statuses.${status}`)}
          </option>
        ))}
      </Select>
    </li>
  );
}
