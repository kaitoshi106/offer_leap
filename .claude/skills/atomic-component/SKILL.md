---
name: atomic-component
description: Use when creating or changing a UI component in apps/web — picks the atomic layer, builds it with Tailwind + design tokens (no UI libraries), and adds story, test and a11y behaviour.
---

# Atomic component

1. **Pick the layer** using the table in `apps/web/AGENTS.md`. If it needs data fetching it is not a component — put
   that in the page. A layer imports only from layers below it.
2. **Check for reuse** in `src/components/**` before creating anything new; extend variants instead of duplicating.
3. **Create the folder** `src/components/<layer>/<Name>/` with:
   - `<Name>.tsx` — typed props (extend the native element props, forward `ref`, spread `...rest`), variants as a
     `const` map, classes merged with `cn()`, colours only from tokens.
   - `<Name>.stories.tsx` — default, every variant, disabled/loading/error, dark mode.
   - `<Name>.test.tsx` — renders, keyboard interaction, accessible name/role (Testing Library queries by role).
   - `index.ts` — re-export, then add to the layer's barrel.
4. **Accessibility**: follow the matching WAI-ARIA APG pattern (dialog, combobox, listbox, tabs…). Visible focus ring,
   full keyboard support, `aria-*` wired, `prefers-reduced-motion` respected.
5. **Copy**: accept text via props or `useTranslations`; never hard-code strings.
6. Run `pnpm --filter @offerleap/web lint typecheck test`.
