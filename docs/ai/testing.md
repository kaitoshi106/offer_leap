# Testing

| Level       | Tool                         | Scope                                                                                                   |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                       | shared helpers, services, hooks, pure components                                                        |
| Component   | Vitest + Testing Library     | atoms → organisms, queried by role/label                                                                |
| API e2e     | Vitest + supertest + test DB | module happy path + auth/permission failures (`apps/api/test`, DB `offerleap_test`)                     |
| Browser E2E | Playwright                   | auth flows today (`apps/web/e2e`); onboarding, CV upload and admin invite next; fails on console errors |
| AI eval     | custom runner                | prompt quality on a fixed set of CVs/JDs                                                                |

- Tests live next to the code: `x.ts` → `x.test.ts`.
- Test behaviour, not implementation; no snapshot tests for logic.
- Every bug fix starts with a failing test.
- CI runs lint, typecheck, unit/component tests and build on every push.
