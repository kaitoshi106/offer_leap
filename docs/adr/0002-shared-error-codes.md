# 0002 — Shared error codes, translations on the web

## Context

The product is bilingual (vi/en). If the API returned translated messages it would need the user's locale on every
request and duplicate copy that already lives in the web app.

## Decision

The API returns `{ statusCode, code, message, fieldErrors?, requestId }` where `code` is an `ErrorCode` from
`@offerleap/shared` and `message` is developer-only. The web app owns every user-facing string and translates
`errors.<CODE>`. Each code's HTTP status is declared next to it with `satisfies Record<ErrorCode, number>`.

## Consequences

- Adding a code without a status fails to compile; a test enforces naming.
- A web i18n test must ensure every code has vi and en text.
- Emails sent by the API are the exception: they use templates per locale on the API side.
