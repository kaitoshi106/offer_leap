---
name: error-code
description: Use when the API needs a new error case — adds the code to @offerleap/shared, maps its HTTP status, and adds vi/en translations on the web app.
---

# Add an error code

1. In `packages/shared/src/errors/error-codes.ts` add `DOMAIN_REASON: 'DOMAIN_REASON'` under the right domain
   comment. Reuse an existing code if the user-facing meaning is the same.
2. Add its HTTP status to `ERROR_HTTP_STATUS` (the `satisfies` check fails until you do).
3. New domain prefix? Add it to `KNOWN_DOMAINS` in `error-codes.test.ts`.
4. Add `errors.DOMAIN_REASON` to `apps/web/messages/vi.json` **and** `en.json`. Message is for end users: short,
   actionable, no technical detail.
5. Throw it from the API with `new AppException(ErrorCode.DOMAIN_REASON)`.
6. Run `pnpm --filter @offerleap/shared test` and the web i18n completeness test.
