# 0004 — AI behind a provider interface, Gemini first

## Context

CV parsing (and later JD analysis, interviews, cover letters) needs a model that reads PDFs, images and text and
returns structured JSON. This is a portfolio project run locally: paid API usage should be zero, and running a local
model is too heavy for a laptop. Free tiers change, get overloaded (HTTP 503) and rate-limit (429).

## Decision

- Feature modules depend on an `AiProvider` interface (`generateJson({ task, system, parts, schema })`), injected
  via the `AI_PROVIDER` token and chosen by the `AI_PROVIDER` env var (Strategy pattern).
- First implementation: **Google Gemini** (`@google/genai`, free tier): native PDF and image input (no OCR tool),
  JSON Schema structured output generated from the same Zod schema that validates the answer.
- Main model plus fallback models tried in order on 429/5xx/timeouts; BullMQ retries the whole job with backoff.
- A **mock** provider with canned answers per task is the default and is forced in tests and browser e2e.

## Consequences

- Swapping or adding a vendor (Claude, OpenAI) is one provider class + config; prompts and callers stay the same.
- Prompts must stay vendor-neutral (no provider-specific features in feature code).
- Free-tier latency varies (seconds to ~30 s), so AI work always runs in a background job with polling in the UI.
- The answer is untrusted: it is validated with Zod and re-checked against the domain rules before use.
