# Architecture

## Overview

```
            HTTPS / JSON + SSE
apps/web (Next.js) ───────────────► apps/api (NestJS, /api/v1)
        │                                │
        │ imports                        ├─► PostgreSQL + pgvector
        ▼                                ├─► Redis (BullMQ queues)
packages/shared ◄──── imports ───────────┤
(error codes, roles, schemas)            ├─► Object storage (R2 / S3)
                                         ├─► SMTP (Mailpit locally)
                                         └─► Claude API
```

- **web** renders UI, owns all translations, talks to the API only (never to the DB or AI provider).
- **api** owns business rules, persistence, background jobs and every AI call.
- **shared** is the contract between them; it has no runtime dependencies on either app.

## Error handling contract

1. API code throws `AppException(ErrorCode.X, { fieldErrors?, cause? })`.
2. A global exception filter maps it to `ApiErrorResponse` with status from `ERROR_HTTP_STATUS`. Unknown errors become
   `COMMON_INTERNAL_ERROR` (details logged with `requestId`, never returned).
3. The web API client checks `isApiErrorResponse(body)` and shows `t('errors.' + code)`; field errors are shown next
   to their inputs.

## Roles & access

| Account         | Created by                               | Can                                                       |
| --------------- | ---------------------------------------- | --------------------------------------------------------- |
| USER            | Self sign-up → verify email → onboarding | Use all candidate features once onboarding is complete    |
| ADMIN · ROOT    | Seed from `ROOT_ADMIN_EMAIL/PASSWORD`    | Everything GENERAL can + invite / revoke / disable admins |
| ADMIN · GENERAL | Invitation from ROOT                     | Admin console: users, taxonomies, AI usage, job retries   |

**Root admin**

- Exactly one, created/updated idempotently by the seed. Its password cannot be changed or reset in the app
  (`AUTH_PASSWORD_CHANGE_NOT_ALLOWED`); rotate by changing the env var and re-running the seed.
- Cannot be disabled or demoted by anyone.

**General admin invitation flow**

1. ROOT submits an email → API creates `AdminInvitation { emailHash, tokenHash, expiresAt (48h), status }` and
   queues an invitation email (localized) containing `/{locale}/admin/invitations/accept?token=…`.
2. The invitee opens the link → web validates the token → shows a sign-up form (name, password).
3. API re-validates the token (single use, not expired, not revoked, email not taken), creates
   `User { role: ADMIN, adminLevel: GENERAL, emailVerifiedAt: now }` and marks the invitation accepted.
4. ROOT can resend (new token, old one invalidated) or revoke pending invitations and disable general admins.
5. General admins can change their password and use forgot-password like users. Admins skip onboarding.

**Guards** (API): `JwtAuthGuard` → `RolesGuard` (`@Roles('ADMIN')`, `@RootOnly()`) → `ProfileCompletedGuard`
(users only). The web middleware mirrors these for redirects only.

## Resume parsing pipeline

```
upload (PDF/DOCX/JPG/PNG/WebP) → magic-byte check + size limit → object storage → BullMQ job
worker: DOCX → mammoth text | image → sharp resize | PDF → as is
      → Claude (document / image / text block) + structured output schema
      → Zod validation → map industry/province to taxonomy codes → store parsed JSON + per-field confidence
      → SSE event → onboarding form pre-filled, AI fields highlighted
```

No separate OCR service: the model reads PDFs (text and scanned) and images directly.

## Theming & i18n

- Light / dark / system themes via CSS variables on `<html data-theme>`, set by an inline script before paint.
- Locales `vi` (default) and `en`, routed as `/{locale}/…`. AI responses use the user's locale.
