# 0001 — Monorepo with pnpm workspaces and Turborepo

## Context

The web app and the API share contracts (error codes, roles, validation schemas). Keeping them in separate repos
means publishing a package or copying types, and contracts drift.

## Decision

One repository: `apps/web`, `apps/api`, `packages/shared`, managed with pnpm workspaces and Turborepo for cached,
dependency-aware tasks. `shared` is built (ESM + CJS) with tsdown so Next.js and NestJS both consume it natively.

## Consequences

- A contract change and both consumers land in one commit; CI verifies all of them together.
- Builds must respect `^build` ordering (handled by Turborepo).
- Slightly more tooling to set up than a single app.
