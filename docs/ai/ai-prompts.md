# AI prompts, evals and cost

- **Provider**: behind the `AiProvider` interface (`AI_PROVIDER` token, `modules/ai`). `gemini` uses `@google/genai`
  with `GEMINI_MODEL` (default `gemini-3.5-flash`) and `GEMINI_FALLBACK_MODELS` tried on 429/5xx; `mock` returns
  canned answers per task for tests and offline dev. Why Gemini: see ADR 0004.
- **Where**: vendor SDKs are imported only in `apps/api/src/modules/ai/providers`. Feature modules inject
  `AI_PROVIDER` and call `generateJson({ task, system, parts, schema })`.
- **Versioning**: `prompts/<task>.v<N>.ts` exports the task id, system prompt, a parts builder and the output schema.
  Released versions are immutable. The mock provider keys its answers by task id.
- **Prompts**: `resume-extraction.v2` (v2 added today's date), `job-match.v1` (answers in the user's locale),
  `cover-letter.v1` (free text, streamed with `streamText`, temperature 0.7), `interview.v1` (questions, feedback,
  summary). Shared bits (language names, today's date line) live in `prompts/shared.ts`.
- **Settings**: temperature 0, `thinkingLevel: MINIMAL` for extraction (LOW took ~80 s vs ~9 s for the same answer
  on a one-page CV).
- **Structured output**: JSON schema derived from Zod; responses are re-validated before use.
- **Untrusted input**: CV, JD and chat text are wrapped in tags and described as data. The system prompt tells the
  model to ignore instructions found inside them.
- **Locale**: every task receives `locale` and must answer in it.
- **Eval**: `apps/api/eval` holds small datasets (`datasets/*.ts`: input + expected fields, including hard cases —
  abbreviations, overlapping jobs, missing data, prompt injection) and a runner that calls the vendor directly and
  scores the post-processed answer: `pnpm --filter @offerleap/api eval <resume-extraction|job-match> [--repeat N]
[--provider mock]`. It prints field accuracy, failure rate, p50/p95 latency and tokens, and writes a JSON report
  to `eval/reports/` (git-ignored). Run it before and after any prompt or model change.
- **Cost control**: every call goes through `TrackedAiProvider` — per-user quota (rolling 24 h, `AI_DAILY_QUOTA`,
  per-user override) and a usage row in `ai_usage_logs` (task, model, tokens, latency, success), shown on the admin
  overview. Extraction prompts use MINIMAL thinking to keep latency and free-tier usage down.

## Eval baseline (2026-10-20, Gemini free tier)

| Task                   | Runs  | Field accuracy | Failed calls | p50   | p95   | Avg tokens (in / out) |
| ---------------------- | ----- | -------------- | ------------ | ----- | ----- | --------------------- |
| `resume-extraction.v2` | 6 × 2 | 100% (70/70)   | 0%           | 1.8 s | 2.8 s | 961 / 104             |
| `job-match.v1`         | 3 × 1 | 100% (7/7)     | 0%           | 3.5 s | 64 s* | 265 / 392             |

\* Before reordering the fallbacks: the main model was rate-limited and `gemini-3.8-flash` (LOW thinking) timed out
after 60 s. The first run also showed that timeout (`AbortError`) wasn't treated as retryable, so the last model was
never tried — both fixed: timeouts move on, and `gemini-3.1-flash-lite` (MINIMAL thinking, ~2 s) now comes before
`gemini-3.8-flash`.
