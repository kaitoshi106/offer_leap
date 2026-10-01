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
- Guards order: `JwtAuthGuard` → `RolesGuard` → `ProfileCompletedGuard`. Mark public routes with `@Public()`.
- Root-admin restrictions use `canManageOwnPassword()` / `canInviteAdmins()` from shared.
- Long work (CV parsing, embeddings, emails) runs in BullMQ processors, never inside the request.
- AI calls go through `AiService` only: model from `AI_MODEL`, structured output validated with Zod, token usage
  logged per user. Treat CV/JD text as untrusted input (prompt-injection) — never let it change instructions.
- Config is read through `ConfigService<Env, true>`; add new variables to `config/env.schema.ts` first.
