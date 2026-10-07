import type { AdminLevel, Role } from '@offerleap/shared';
import type { Request } from 'express';

/** Claims inside the access token (JWT). Keep it small: it travels with every request. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  adminLevel: AdminLevel | null;
}

export interface AppRequest extends Request {
  requestId: string;
  /** Set by `JwtAuthGuard` on authenticated routes. */
  user?: AccessTokenPayload;
}

/** Metadata stored with a refresh token so users can recognise their sessions later. */
export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * @description Extracts the client metadata recorded with each session.
 * @param request - Incoming request.
 * @returns User agent and IP (behind a proxy, enable Express `trust proxy` for the real IP).
 */
export function clientInfo(request: Request): ClientInfo {
  return { userAgent: request.headers['user-agent']?.slice(0, 255), ipAddress: request.ip };
}
