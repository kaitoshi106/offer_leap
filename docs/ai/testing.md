# Testing

| Level       | Tool                         | Scope                                                                                                                                                                                                 |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                       | shared helpers, services, hooks, pure components                                                                                                                                                      |
| Component   | Vitest + Testing Library     | atoms → organisms, queried by role/label                                                                                                                                                              |
| API e2e     | Vitest + supertest + test DB | module happy path + auth/permission failures (`apps/api/test`, DB `offerleap_test`)                                                                                                                   |
| Browser E2E | Playwright                   | full user flows (`apps/web/e2e`): auth, onboarding + CV, analyses, board, interviews, admin; fails on console errors; `a11y.spec.ts` scans every page with axe (WCAG 2.2 A/AA) in light and dark mode |
| AI eval     | custom runner                | prompt quality on a fixed set of CVs/JDs                                                                                                                                                              |

- Tests live next to the code: `x.ts` → `x.test.ts`.
- Test behaviour, not implementation; no snapshot tests for logic.
- Every bug fix starts with a failing test.
- CI runs lint, typecheck, unit/component tests and build on every push.

## Browser tests next to your own `pnpm dev`

Run an isolated API on the **test database** (never the dev root) and a production build of the web app:

```bash
export TESTDB=postgresql://offerleap:offerleap@localhost:5432/offerleap_test
cd apps/api
DATABASE_URL=$TESTDB pnpm exec prisma migrate deploy
DATABASE_URL=$TESTDB ROOT_ADMIN_EMAIL=root@offerleap.test ROOT_ADMIN_PASSWORD=e2e-root-password-2026 pnpm exec tsx prisma/seed.ts
pnpm exec tsc -p tsconfig.build.json --outDir .e2e-dist
DATABASE_URL=$TESTDB NODE_ENV=test AI_PROVIDER=mock API_PORT=4100 WEB_ORIGIN=http://localhost:3100 node .e2e-dist/main.js &
cd ../web
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1 pnpm exec next build && pnpm exec next start -p 3100 &
E2E_WEB_PORT=3100 E2E_API_PORT=4100 E2E_ROOT_EMAIL=root@offerleap.test E2E_ROOT_PASSWORD=e2e-root-password-2026 pnpm test:browser
```

API e2e (`pnpm test:e2e`) truncates the test database, so re-run the seed before the browser tests afterwards.
