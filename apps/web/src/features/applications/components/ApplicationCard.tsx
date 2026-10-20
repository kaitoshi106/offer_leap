'use client';

import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationSummary } from '@offerleap/shared';
import { useTranslations } from 'next-intl';
import type { DragEvent } from 'react';

import { Badge, Icon, Select } from '@/components/atoms';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

import { scoreBand } from '../../analyses/components/match';

export interface ApplicationCardProps {
  application: ApplicationSummary;
  /** Keyboard / touch alternative to dragging. */
  onMove: (status: ApplicationStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  dragging?: boolean;
  /** A dragged card would land above this one. */
  dropIndicator?: boolean;
}

/**
 * @description Kanban card. Draggable with a mouse; the column `<select>` does the same for keyboard, touch and
 * screen-reader users (HTML drag and drop works for none of them).
 * @param props - {@link ApplicationCardProps}
 */
export function ApplicationCard({
  application,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragging,
  dropIndicator,
}: ApplicationCardProps) {
  const t = useTranslations('applications');
  const names = { jobTitle: application.jobTitle, company: application.company };

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        // Firefox only starts a drag when some data is set.
        event.dataTransfer.setData('text/plain', application.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'relative flex cursor-grab flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition',
        'hover:border-primary active:cursor-grabbing has-focus-visible:border-primary',
        dragging && 'opacity-40',
        dropIndicator &&
          'before:absolute before:inset-x-0 before:-top-2 before:h-0.5 before:rounded-full before:bg-primary',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <Link
          href={`/applications/${application.id}`}
          aria-label={t('card.open', names)}
          className="font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-lg hover:text-primary-text"
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
        onChange={(event) => onMove(event.target.value as ApplicationStatus)}
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
