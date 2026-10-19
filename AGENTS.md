# OfferLeap — Agent Guide

> Make the Leap. Land the Offer.

AI-powered job application assistant: users upload a CV (PDF / DOCX / image), AI fills their profile, scores the CV
against a job description, runs mock interviews and drafts cover letters. Admins manage users, taxonomies and AI usage.

This file is the entry point for any AI coding assistant. Read it fully, then the doc that matches your task.

## Repository map

| Path              | What lives there                                                     | Guide                |
| ----------------- | -------------------------------------------------------------------- | -------------------- |
| `apps/web`        | Next.js (App Router) + Tailwind, atomic-design components, next-intl | `apps/web/AGENTS.md` |
| `apps/api`        | NestJS REST API, Prisma, BullMQ workers, AI provider (Gemini)        | `apps/api/AGENTS.md` |
| `packages/shared` | Contracts used by both apps: error codes, roles, constants, schemas  | this file            |
| `docs/ai`         | Architecture, conventions, best practices                            | `docs/ai/*.md`       |
| `docs/adr`        | Architecture Decision Records                                        | `docs/adr/README.md` |

## Commands

```bash
pnpm install          # Node >= 24 (see .nvmrc), pnpm 12
pnpm infra:up         # Postgres (pgvector), Redis, Mailpit
pnpm dev              # web on :3000, api on :4000
pnpm lint && pnpm typecheck && pnpm test   # must pass before you say you're done
pnpm build
pnpm --filter @offerleap/api <script>      # run a script in one workspace
```

## Non-negotiable rules

1. **Contracts live in `@offerleap/shared`.** Error codes, roles, locales and request/response schemas are defined
   once there and imported by both apps. Never redeclare them locally.
2. **The API never returns user-facing text.** Throw an `ErrorCode`; the web app translates `errors.<CODE>`.
   Adding a code means: add it to `ErrorCode` + `ERROR_HTTP_STATUS`, then add `vi` **and** `en` translations.
3. **No external UI component libraries** (no shadcn, MUI, Radix, Headless UI…). Build components in
   `apps/web/src/components/{atoms,molecules,organisms,templates}` with Tailwind. Studying their UX is fine.
4. **Every UI string goes through i18n** (`vi` default, `en`). No hard-coded copy in components.
5. **Every colour comes from design tokens** so light/dark mode keep working. No raw hex in components.
6. **Authorization is enforced on the API.** Frontend checks are UX only.
7. **Root admin cannot change or reset its password from the app** — only via env + seed. Use
   `canManageOwnPassword()` from shared instead of re-implementing the rule.
8. **Secrets never reach the client or logs.** Only `NEXT_PUBLIC_*` vars are exposed to the browser.
9. **Do not add dependencies** without stating why in the PR/commit body. Prefer what's already installed.
10. Code comments use JSDoc blocks: `/** @description … @param … @returns … @throws … */`.

## Roles

| Role / level        | How it is created                                        | Password change / reset |
| ------------------- | -------------------------------------------------------- | ----------------------- |
| `USER`              | Self sign-up + email verification + mandatory onboarding | Yes                     |
| `ADMIN` · `ROOT`    | Seed script from `ROOT_ADMIN_*` env vars (exactly one)   | **No**                  |
| `ADMIN` · `GENERAL` | Invited by ROOT via email link → sets up account         | Yes                     |

Details: `docs/ai/architecture.md#roles--access`.

## Where to look next

- Architecture & data flow → `docs/ai/architecture.md`
- Folder structure → `docs/ai/structure.md`
- Naming, commits, branches → `docs/ai/conventions.md`
- Frontend / backend practices → `docs/ai/best-practices-fe.md`, `docs/ai/best-practices-be.md`
- Testing → `docs/ai/testing.md`
- Prompts, evals, AI cost → `docs/ai/ai-prompts.md`
- Domain vocabulary → `docs/ai/glossary.md`
