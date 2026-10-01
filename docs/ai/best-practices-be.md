# Backend best practices

- **Thin controllers, rich services.** Controllers parse/authorize/delegate; services hold rules.
- **Validate at the edge** with Zod; trust types inside.
- **Errors are codes** (`AppException(ErrorCode.X)`); one global filter formats responses.
- **Transactions** for multi-row writes; idempotency keys for retried jobs.
- **Security**: argon2id hashes, httpOnly + SameSite cookies for tokens, refresh token rotation, rate limits on auth
  endpoints, no user enumeration, helmet, strict CORS, PII never logged.
- **Background jobs** for anything slow or flaky (AI, email, file processing) with retries + backoff and a
  dead-letter view for admins.
- **AI calls**: single `AiService`, structured outputs, Zod re-validation, per-user quota, usage + cost logging,
  untrusted content isolated in the prompt.
- **Config** validated at boot (`env.schema.ts`); fail fast.
- **Observability**: request id on every log line and error response; health endpoint for probes.
