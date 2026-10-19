# AI prompts, evals and cost

- **Provider**: behind the `AiProvider` interface (`AI_PROVIDER` token, `modules/ai`). `gemini` uses `@google/genai`
  with `GEMINI_MODEL` (default `gemini-3.5-flash`) and `GEMINI_FALLBACK_MODELS` tried on 429/5xx; `mock` returns
  canned answers per task for tests and offline dev. Why Gemini: see ADR 0004.
- **Where**: vendor SDKs are imported only in `apps/api/src/modules/ai/providers`. Feature modules inject
  `AI_PROVIDER` and call `generateJson({ task, system, parts, schema })`.
- **Versioning**: `prompts/<task>.v<N>.ts` exports the task id, system prompt, a parts builder and the output schema.
  Released versions are immutable. The mock provider keys its answers by task id.
- **Settings**: temperature 0, `thinkingLevel: MINIMAL` for extraction (LOW took ~80 s vs ~9 s for the same answer
  on a one-page CV).
- **Structured output**: JSON schema derived from Zod; responses are re-validated before use.
- **Untrusted input**: CV, JD and chat text are wrapped in tags and described as data. The system prompt tells the
  model to ignore instructions found inside them.
- **Locale**: every task receives `locale` and must answer in it.
- **Eval**: `apps/api/eval/<task>/` holds inputs + expected outputs; the runner reports field accuracy, failure rate,
  p95 latency, tokens and estimated cost per call.
- **Cost control**: prompt caching for stable system prompts, per-user daily quotas, usage logged per call
  (`ai_usage_logs`) and surfaced in the admin console.
