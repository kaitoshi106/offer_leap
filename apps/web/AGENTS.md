# apps/web — Agent Guide

Next.js App Router · React 19 · Tailwind CSS v4 · next-intl · no UI component libraries.

## Component layers (atomic design)

| Layer        | Rule of thumb                                                        | Examples                            |
| ------------ | -------------------------------------------------------------------- | ----------------------------------- |
| `atoms`      | One HTML element (or close), no app state, fully controlled by props | Button, Input, Label, Badge, Icon   |
| `molecules`  | A few atoms with one job                                             | FormField, SearchBox, FileDropzone  |
| `organisms`  | Self-contained section, may hold UI state, a11y-heavy widgets        | Dialog, Combobox, OnboardingStepper |
| `templates`  | Page layouts with slots, no data fetching                            | AuthLayout, DashboardLayout         |
| `app/` pages | Route entry: fetch data, compose templates/organisms                 | `app/[locale]/onboarding/page.tsx`  |

A layer may import only from layers below it. Pages are the only place that fetch data.

## Rules

- Server Components by default; add `'use client'` only for state, effects or browser APIs.
- Styling: Tailwind utilities that reference design tokens (`bg-surface`, `text-fg-muted`). Variants via a local
  `cva`-style map, class merging via `cn()`. No inline styles, no raw colours.
- Accessibility: follow WAI-ARIA Authoring Practices for every interactive organism (focus trap, Esc, roving
  tabindex, `aria-*`). Every input has a label. Respect `prefers-reduced-motion`.
- i18n: all copy via `useTranslations` / `getTranslations`; add keys to both `messages/vi.json` and `messages/en.json`.
- API errors: map `ApiErrorResponse.code` to `t('errors.<CODE>')`; never display `message`.
- Each component folder: `Component.tsx`, `Component.stories.tsx`, `Component.test.tsx`, `index.ts`.
