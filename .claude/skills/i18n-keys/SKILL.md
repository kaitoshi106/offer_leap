---
name: i18n-keys
description: Use when adding or changing any user-facing text in apps/web — adds keys to both vi and en messages with consistent naming.
---

# i18n keys

- Files: `apps/web/messages/vi.json` (default) and `apps/web/messages/en.json`. Both must have identical key sets.
- Key path: `<area>.<component-or-page>.<element>` in camelCase, e.g. `onboarding.stepProfile.title`.
- Shared words go under `common.*` (`common.actions.save`). Error codes under `errors.<CODE>`.
- Use ICU for plurals and variables: `"{count, plural, one {# year} other {# years}}"`.
- Vietnamese copy is written natively (not translated word-for-word); keep tone friendly and concise.
- Never concatenate translated fragments — use one key with variables.
- Run the i18n completeness test after editing.
