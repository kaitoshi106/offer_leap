# Architecture

## Overview

```
            HTTPS / JSON + SSE
apps/web (Next.js) ───────────────► apps/api (NestJS, /api/v1)
        │                                │
        │ imports                        ├─► PostgreSQL + pgvector
        ▼                                ├─► Redis (BullMQ queues)
packages/shared ◄──── imports ───────────┤
(error codes, roles, schemas)            ├─► File storage (local disk; S3/R2 later)
                                         ├─► SMTP (Mailpit locally)
                                         └─► AI provider (Gemini; mock in tests)
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

## Authentication & sessions

```
POST /auth/register ─► user (unverified) ─► BullMQ "mail" ─► SMTP (Mailpit locally)
POST /auth/verify-email {token} ─► emailVerifiedAt + session
POST /auth/login ─► session          POST /auth/refresh ─► rotated session
POST /auth/logout · GET /auth/me · forgot / reset / change password
```

- **Access token**: JWT (HS256, 15 min) with `{ sub, role, adminLevel }`, in httpOnly cookie `ol_at` (path `/`).
  `Authorization: Bearer` is accepted too (scripts, tests).
- **Refresh token**: 256-bit opaque value in httpOnly cookie `ol_rt`, scoped to `/api/v1/auth`, stored as SHA-256 in
  `refresh_tokens`. Every refresh **rotates** it; tokens of one login share a `familyId`. Presenting an already
  rotated token more than 15 s later (theft, not a multi-tab race) revokes the whole family.
- **Session flag**: `ol_session=1` (path `/`, no secret) lives as long as the refresh token so the web proxy can
  redirect signed-out visitors; the API never trusts it.
- **Cookies**: `SameSite=Lax` (CSRF), `Secure` in production. Web and API must be same-site (e.g. `app.` / `api.`
  subdomains) in production.
- **Email tokens** (`user_tokens`): single-use, hashed, 24 h (verification) / 30 min (reset); a new one invalidates
  older ones of the same type.
- **No enumeration**: login returns the same error for unknown email and wrong password (with equal timing);
  forgot-password / resend-verification always answer 202.
- **Passwords**: argon2id (`@node-rs/argon2`); a reset or change revokes every refresh token of the user.
- **Rate limits**: 120 req/min per IP globally, 5/min on login, register, forgot/reset, resend, change password.
- **Docs**: Swagger UI at `/api/docs` (spec at `/api/docs/openapi.json`) outside production, generated from the
  shared Zod schemas. Calls from the UI share the API origin, so login cookies apply to later calls.
- **Errors**: `AppException(ErrorCode)` → `AllExceptionsFilter` → `ApiErrorResponse` with `requestId` (also in the
  `X-Request-Id` header). Validation errors carry `fieldErrors: [{ field, rule, params }]`.

## Onboarding

- `Profile` (1–1 with `User`) holds career data; every column is nullable so the wizard can save a **draft per
  step** (`PUT /onboarding/draft` with `{ step, values }`, validated by that step's shared schema).
  `Profile.onboardingStep` is the resume point and only moves forward.
- `POST /onboarding/complete` validates the whole draft with `completeOnboardingSchema`; on success
  `User.onboardingCompletedAt` is set. Errors list every missing field so the client can open the right step.
- `ProfileCompletedGuard` (global, after `RolesGuard`) blocks USER accounts without a completed profile with
  `ONBOARDING_REQUIRED`, except on routes marked `@AllowIncompleteProfile()` (auth, onboarding). Admins are exempt.
- Taxonomies (`industries`, `provinces` — the 34 units in effect since 1 July 2025) are seeded by code and served
  publicly with `Cache-Control: public, max-age=3600`.
- Web: verify-email and login send unfinished profiles to `/onboarding`; the dashboard does the same.

## Resume parsing pipeline

```
POST /resumes (multipart, ≤ 10 MB) → magic-byte check (PDF/DOCX/PNG/JPEG/WEBP) → StorageService → Resume row
  (PENDING) → BullMQ `resume` job → 202
worker: PDF / image → sent inline to the model | DOCX → mammoth raw text inside <cv> tags
      → AiProvider.generateJson (prompt resume-extraction.v2, JSON Schema from Zod, taxonomy codes as enums)
      → Zod validation → toResumeSuggestions (re-validated with the onboarding rules)
      → one transaction: values found overwrite the onboarding draft + resume COMPLETED with token usage
web: polls GET /resumes/:id every 1.5 s → refetches GET /onboarding → fields holding the CV's values are marked
     "AI suggested"; fields the model flagged as guesses ask the user to check
```

- No separate OCR service: Gemini reads PDFs (text and scanned) and images natively.
- Failures: a busy provider (429/5xx, timeout) tries the fallback models, then BullMQ retries the job (3 attempts,
  exponential backoff) → `AI_UNAVAILABLE`. An unusable answer or empty DOCX fails at once → `RESUME_PARSE_FAILED`.
  The CV step is optional, so the user can always skip and type.
- The CV wins at the moment parsing finishes: every value it contains replaces the draft value (fields it lacks,
  like salary, are kept). Edits saved afterwards win as usual. Only while onboarding is open.
- Phone numbers are stored as 10 digits starting with 0 (`+84 912 345 678` → `0912345678`) by the shared schema.
- `AI_PROVIDER=mock` (default, and forced in tests) returns canned answers; `gemini` needs `GEMINI_API_KEY`.
- Queues use the `bull-test` prefix when `NODE_ENV=test`, so dev workers never pick up test jobs.

## CV ↔ job analysis

```
POST /analyses { resumeId, jobDescription, locale } → resume must be the user's → JobAnalysis (PENDING) → BullMQ
  `analysis` job → 202
worker: load the CV like the parser (PDF/image inline, DOCX text) + job description in <job> tags
      → AiProvider.generateJson (prompt job-match.v1, answer in `locale`, today's date in the prompt)
      → toAnalysisResult (trim, de-duplicate, required gaps first) → score/jobTitle/company columns + result JSON
web: /analyses (form + history) → /analyses/:id polls every 2 s → score gauge, skills, strengths, gaps, edits
```

- Both AI jobs share `runAiJob` (`modules/ai/ai-job.ts`): busy provider → BullMQ retry with backoff; anything
  else → FAILED with the feature's code (`RESUME_PARSE_FAILED`, `ANALYSIS_FAILED`) or `AI_UNAVAILABLE`.
- Requires a completed profile (global `ProfileCompletedGuard`). Throttled to 20 analyses per hour.
- Score bands (`matchLevel` in shared): ≥ 80 strong, ≥ 65 good, ≥ 45 fair, else weak — same labels everywhere.
- Prompts state today's date: without it the model counts "2019 – present" up to its training cutoff.

## Applications & cover letters

- `JobApplication`: a kanban card (`SAVED → APPLIED → INTERVIEW → OFFER / REJECTED`) with job details, notes and a
  cover letter; optionally linked to the analysis it was created from (its job description is copied, its score
  shown; the link is cleared if the analysis is deleted).
- Ordering uses **fractional positions**: a moved card gets the midpoint of its new neighbours, so a move is one
  `PATCH /applications/:id/move { status, position }`. The board updates optimistically and rolls back on error.
  Cards move by HTML5 drag and drop or by a per-card column `<select>` (keyboard, touch, screen readers).
- Cover letters are **streamed**: `POST /applications/:id/cover-letter` answers `text/plain` chunks while the
  model writes (`AiProvider.streamText`, prompt `cover-letter.v1`). Everything that can fail cleanly (no job
  description, AI unavailable) is checked before the first byte, so it is still a JSON error; a failure mid-way
  cuts the connection and the client shows `STREAM_INTERRUPTED`. The finished letter is saved; leaving the page
  aborts the request and the server stops reading from the model.

## Theming & i18n

- Light / dark themes via CSS variables on `<html data-theme>`, set by an inline script before paint. Until the user
  flips the switch the OS colour scheme is used (no flash); the choice is then stored in localStorage.
- Locales `vi` (default) and `en`, routed as `/{locale}/…`. AI responses use the user's locale.
