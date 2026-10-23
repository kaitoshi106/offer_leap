import { Prisma } from '../../generated/prisma/client';

/**
 * @description Whether a database write failed on a unique constraint — typically two requests creating the same
 * thing at once, after both checked that it didn't exist yet.
 * @param error - Anything thrown by Prisma.
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * @description Whether a write failed on a foreign key — e.g. creating a row for a user deleted a moment ago,
 * whose access token is still valid.
 * @param error - Anything thrown by Prisma.
 */
export function isMissingReference(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}
