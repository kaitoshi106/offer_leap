# Frontend best practices

- **Server first.** Fetch on the server in pages/layouts; push `'use client'` to the leaves.
- **Atomic layers** (see `apps/web/AGENTS.md`). Lower layers know nothing about the app domain.
- **Design tokens** in `src/styles/tokens.css` via Tailwind `@theme`; semantic names (`surface`, `fg`, `primary`,
  `danger`) mapped per theme. Components use only semantic utilities.
- **Dark mode without flash**: inline script in `<head>` sets `data-theme` from cookie / `prefers-color-scheme`
  before first paint; the toggle writes a cookie so the server renders the same theme.
- **Forms**: react-hook-form + the Zod schema from `@offerleap/shared` (same rules as the API). Show field errors
  from both client validation and `ApiErrorResponse.fieldErrors`.
- **Data**: one typed API client in `src/lib/api`; React Query for client-side caching and mutations; SSE via a
  small `useEventSource` hook.
- **A11y**: semantic HTML first, ARIA second. Keyboard-test every organism. Never remove focus outlines.
- **Performance**: `next/image`, `next/font`, dynamic import for heavy organisms (chat, kanban), avoid layout shift.
- **No UI component libraries.** Read Radix/shadcn source for behaviour ideas, then implement ourselves.
