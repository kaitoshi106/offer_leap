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
- Responsive: every page must work at 320px wide (the narrowest phones). Grids always declare columns with `minmax(0, …)` — `grid-cols-1` on phones too (an implicit or bare `fr`
  track grows to its widest content), wide tables sit in a sideways-scrolling container that is focusable and named when it has no
  focusable content, long values wrap (`wrap-anywhere`). `e2e/a11y.spec.ts` checks every page at phone width.
  Below 1024px (`lg`) the signed-in header is ☰ + brand; navigation, language, theme and account live in the `Drawer`
  (`AppLayout` `menuLabels` / `menuFooter`), which closes itself when the window grows past `lg`. From `lg` the full
  row is shown; between `lg` and `xl` its navigation drops the icons and tightens its spacing to fit (~920px).
- i18n: all copy via `useTranslations` / `getTranslations`; add keys to both `messages/vi.json` and `messages/en.json`.
- API errors: map `ApiErrorResponse.code` to `t('errors.<CODE>')`; never display `message`.
- Each component folder: `Component.tsx`, `Component.stories.tsx`, `Component.test.tsx`, `index.ts`.
- Data: call the API only through `apiRequest` (`src/lib/api/client.ts`) or a feature's `*-api.ts`; it sends cookies,
  throws `ApiError`, and refreshes the session once on 401. Server state lives in React Query hooks (`use-*.ts`).
- Forms: `useForm({ resolver: sharedSchemaResolver(schemaFromShared) })`, render inputs inside `FormField`, show
  errors with `useFieldErrorText()`, and push API 422s back with `applyServerFieldErrors`. Never re-declare rules.
- Errors: `useErrorText()(error)` → `errors.<CODE>`. Session changes (sign in/out, verify) navigate with
  `useAuthRedirect()` (full page load) so no Router Cache entry from the old session is reused.
- Long option lists use `Combobox` (accent-insensitive search via `foldForSearch`); short ones use native `Select`.
  Free-text lists use `TagInput`. Bind them to RHF with `Controller`.
- Sign out only through `useLogout()`: it reloads on /login so no page reacts to a half-cleared cache.
- Route access: `src/lib/route-access.ts` (protected / guest-only prefixes) is applied by `src/proxy.ts` using the
  `ol_session` and `ol_onboarding` flag cookies (signed out → login; onboarding pending ↔ done), before any page
  renders; pages still handle a session that turns out to be invalid.
- Browser tests: `pnpm --filter @offerleap/web test:browser` (Playwright, `e2e/`, needs `pnpm infra:up`); every test
  fails on console errors.
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (`src/proxy.ts` runs the next-intl locale redirect).
- Links and navigation come from `@/i18n/navigation` (locale-aware), never from `next/link` / `next/navigation`.
- Theme: light/dark only (`ThemeProvider` + `useTheme()`; follows the OS until chosen). Text and links use
  `text-primary-text`, fills use `bg-primary`; brand surfaces use the `brand-*` tokens.
  The inline `themeInitScript` applies `data-theme` before paint.
- Tests: Vitest + Testing Library (`pnpm --filter @offerleap/web test`); wrap with `renderWithProviders` from
  `@/test/render` when a component needs translations or theme. Stories: `pnpm storybook` (root).
- Stories never expose `ReactNode` props as controls: hide them and drive them with `iconOptionControl` / text
  args from `@/stories/controls`; demo copy comes from `storyCopy(globals)` so the Language toolbar works.
  `src/stories/stories.test.tsx` renders every story in both locales.
