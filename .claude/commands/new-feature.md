---
description: Plan and implement a feature end-to-end across shared, api and web
argument-hint: <feature description>
---

Implement this feature: $ARGUMENTS

1. Read `AGENTS.md`, `docs/ai/architecture.md` and the app guides. Restate the feature and list open questions.
2. Write a short plan: shared contracts → API (module, migration, errors) → web (components by layer, pages, i18n).
3. Implement in that order using the project skills (`nest-module`, `prisma-migration`, `error-code`,
   `atomic-component`, `i18n-keys`).
4. Run `pnpm lint && pnpm typecheck && pnpm test`, then use the `code-reviewer` agent on the diff.
5. Summarise what changed and anything left undone.
