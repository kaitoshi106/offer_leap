---
name: ai-prompt-change
description: Use when creating or editing an LLM prompt or its output schema in apps/api — versions the prompt, runs the eval set and reports quality, latency and cost changes.
---

# Change an AI prompt

1. Prompts live in `apps/api/src/modules/ai/prompts/<task>.v<N>.ts`. Never edit a released version — copy to `v<N+1>`.
2. Output is a Zod schema passed as structured output; the service validates it again before use.
3. User content (CV text, JD, answers) goes inside clearly delimited tags and is treated as data, not instructions.
4. Respond in the user's locale (`vi` | `en`), passed explicitly.
5. Run `pnpm --filter @offerleap/api eval <task>` and compare with the previous version: field accuracy, failures,
   p95 latency, tokens per call. Paste the table in the PR.
6. Point the calling service at the new version only if quality is equal or better, and add a mock answer for the
   new task id in `providers/mock.provider.ts`.
   See `docs/ai/ai-prompts.md`.
