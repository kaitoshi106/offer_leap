import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationSummary } from '@offerleap/shared';

/**
 * @description Position for a card dropped between two neighbours (fractional indexing): the midpoint, or one
 * step past the only neighbour. Only the moved card changes, so a move is a single small request.
 * @param before - Position of the card that will be above it, if any.
 * @param after - Position of the card that will be below it, if any.
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (after !== undefined) return after - 1;
  if (before !== undefined) return before + 1;
  return 0;
}

/**
 * @description Splits the cards into the board's columns, each sorted by position.
 * @param applications - Every card.
 */
export function toColumns(
  applications: ApplicationSummary[],
): Record<ApplicationStatus, ApplicationSummary[]> {
  const columns = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, []])) as unknown as Record<
    ApplicationStatus,
    ApplicationSummary[]
  >;
  for (const application of applications) columns[application.status].push(application);
  for (const status of APPLICATION_STATUSES) columns[status].sort((a, b) => a.position - b.position);
  return columns;
}

/**
 * @description Where a card lands: before `beforeId` in the target column, or at the end when it is omitted
 * (dropped on empty space). The card itself is ignored when computing neighbours.
 * @param column - Cards of the target column, sorted.
 * @param cardId - Card being moved.
 * @param beforeId - Card it is dropped onto (lands above it).
 */
export function dropPosition(column: ApplicationSummary[], cardId: string, beforeId?: string): number {
  const others = column.filter((card) => card.id !== cardId);
  const index = beforeId ? others.findIndex((card) => card.id === beforeId) : -1;
  if (index === -1) return positionBetween(others.at(-1)?.position, undefined);
  return positionBetween(others[index - 1]?.position, others[index]!.position);
}
