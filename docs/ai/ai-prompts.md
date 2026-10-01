# AI prompts, evals and cost

- **Provider**: Anthropic Claude via `@anthropic-ai/sdk`; model from `AI_MODEL` (default `claude-opus-5-5`).
- **Where**: only `apps/api/src/modules/ai`. Other modules call `AiService` methods (`parseResume`, `scoreMatch`,
  `interviewTurn`, `writeCoverLetter`).
- **Versioning**: `prompts/<task>.v<N>.ts` exports `{ system, buildUserContent, outputSchema }`. Released versions are
  immutable.
- **Structured output**: JSON schema derived from Zod; responses are re-validated before use.
- **Untrusted input**: CV, JD and chat text are wrapped in tags and described as data. The system prompt tells the
  model to ignore instructions found inside them.
- **Locale**: every task receives `locale` and must answer in it.
- **Eval**: `apps/api/eval/<task>/` holds inputs + expected outputs; the runner reports field accuracy, failure rate,
  p95 latency, tokens and estimated cost per call.
- **Cost control**: prompt caching for stable system prompts, per-user daily quotas, usage logged per call
  (`ai_usage_logs`) and surfaced in the admin console.
