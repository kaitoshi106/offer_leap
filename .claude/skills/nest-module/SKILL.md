---
name: nest-module
description: Use when adding a backend feature or endpoint in apps/api — scaffolds a NestJS module with thin controller, service, Zod DTOs, guards, error codes and tests.
---

# Nest module

1. Create `src/modules/<feature>/` following `apps/api/AGENTS.md`. Register the module in `AppModule`.
2. **DTOs**: define request/response Zod schemas in `@offerleap/shared` when the web app uses them, otherwise in
   `dto/`. Validate with the global `ZodValidationPipe`.
3. **Controller**: route decorators, `@Roles()` / `@Public()`, call one service method, return plain objects.
4. **Docs**: `@ApiTags`, `@ApiOperation`, `@ApiZodBody`, `@ApiZodResponse`, `@ApiErrors` on every route; check it
   at http://localhost:4000/api/docs.
5. **Service**: business rules, Prisma access, transactions (`prisma.$transaction`) for multi-write operations.
6. **Errors**: throw `AppException(ErrorCode.X)`. New code? Use the `error-code` skill.
7. **Background work**: enqueue a BullMQ job; implement the processor in `<feature>.processor.ts`.
8. **Tests**: service unit tests with a mocked Prisma; e2e test for the happy path + one auth failure.
9. Run `pnpm --filter @offerleap/api lint typecheck test`.
