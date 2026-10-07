---
name: prisma-migration
description: Use when changing the database schema — edits schema.prisma, creates a named migration, updates seed data and shared types.
---

# Prisma migration

1. Edit `apps/api/prisma/schema.prisma`. Tables `snake_case` via `@@map`, fields camelCase, ids `cuid()`,
   timestamps `createdAt` / `updatedAt`, soft delete via `deletedAt` only where the product needs restore.
2. `pnpm --filter @offerleap/api db:migrate --name <verb_noun>` (e.g. `add_admin_invitations`). The generated
   client goes to `apps/api/src/generated/prisma` (git-ignored).
3. Review the generated SQL — no accidental drops, indexes on every foreign key and frequent filter.
4. Update `prisma/seed.ts` when reference data (industries, provinces, root admin) changes; seeds must be idempotent
   (`upsert`).
5. If an enum is mirrored in `@offerleap/shared` (e.g. `Role`), keep both in sync.
6. Never edit a migration that has been committed; create a new one.
