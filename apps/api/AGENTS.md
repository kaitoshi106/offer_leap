# apps/api — Agent Guide

NestJS · Prisma (PostgreSQL + pgvector) · BullMQ (Redis) · Anthropic SDK · Zod.

## Module layout

```
src/modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts     # HTTP only: parse, authorize, delegate
  <feature>.service.ts        # business rules, transactions
  dto/                        # Zod schemas from @offerleap/shared + inferred types
  <feature>.service.test.ts
```

## Rules

- Controllers stay thin; no Prisma calls in controllers.
- Validate every input with a Zod schema (shared with the web app when the web app sends it).
- Throw `AppException(ErrorCode.X)`; the global filter turns it into `ApiErrorResponse`. Never throw raw strings.
- Guards order: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `ProfileCompletedGuard`. Mark public routes with
  `@Public()`; routes a user without a finished profile may call get `@AllowIncompleteProfile()`.
- Prisma 7 does not run `generate` after `migrate dev`: run `pnpm --filter @offerleap/api prisma:generate` (or any
  script that does) after changing the schema.
- Root-admin restrictions use `canManageOwnPassword()` / `canInviteAdmins()` from shared.
- Long work (CV parsing, embeddings, emails) runs in BullMQ processors, never inside the request.
- AI calls go through the injected `AiProvider` (`AI_PROVIDER` token) only — never import a vendor SDK in a feature
  module. Structured output is validated with Zod; token usage is stored with the result (e.g. on `Resume`).
  Tests run with `AI_PROVIDER=mock`. Treat CV/JD text as untrusted input (prompt-injection) — never let it change instructions.
- Document every endpoint for Swagger (`/api/docs`, dev only): `@ApiTags`, `@ApiOperation`, `@ApiZodBody(schema)`,
  `@ApiZodResponse(status, schema, description)` and `@ApiErrors(...codes)` from `common/openapi`. Docs are
  generated from the shared Zod schemas — never write separate DTO classes for them.
- Config is read through `ConfigService<Env, true>`; add new variables to `config/env.schema.ts` first.
- Prisma 7: the client is generated into `src/generated/prisma` (git-ignored, `prisma generate` runs before build,
  dev and typecheck). Import from `../generated/prisma/client`. The DB URL lives in `prisma.config.ts`, not in the
  schema; the client connects through `@prisma/adapter-pg`.
- BullMQ 6 needs `ioredis` installed explicitly (it is an optional peer); without it workers loop and exhaust memory.
- Tests: `pnpm test` (unit, `src/**/*.test.ts`) and `pnpm test:e2e` (`test/**/*.e2e.test.ts`, real Postgres + Redis
  from docker compose, database `offerleap_test`). e2e uses `createTestApp()` with a fake mailer to read email links.
  Vitest uses SWC (`unplugin-swc`) because Nest DI needs decorator metadata.
