# Conventions

## Naming

| Thing                      | Style                    | Example                        |
| -------------------------- | ------------------------ | ------------------------------ |
| React component / file     | PascalCase               | `FormField.tsx`                |
| Hooks                      | `use` + camelCase        | `useFocusTrap.ts`              |
| Nest files                 | kebab-case + role suffix | `admin-invitation.service.ts`  |
| Classes                    | PascalCase               | `AdminInvitationService`       |
| Constants / enum-like maps | UPPER_SNAKE / PascalCase | `ERROR_HTTP_STATUS`, `Role`    |
| Error codes                | `DOMAIN_REASON`          | `AUTH_EMAIL_TAKEN`             |
| i18n keys                  | dot.path.camelCase       | `onboarding.stepProfile.title` |
| DB tables                  | snake_case plural        | `admin_invitations`            |
| Env vars                   | UPPER_SNAKE              | `ROOT_ADMIN_EMAIL`             |

## Comments

JSDoc block on exported functions, classes and non-obvious logic:

```ts
/**
 * @description What it does and why it exists.
 * @param name - Meaning, units, constraints.
 * @returns What comes back.
 * @throws When and which error code.
 */
```

Explain _why_, not _what_ the code already says.

## Git

- Branches: `feat/<scope>-<topic>`, `fix/…`, `chore/…`, `docs/…`. `study/*` and `local/*` are personal branches;
  `.husky/pre-push` refuses to push them.
- Commits: Conventional Commits, enforced by commitlint. Scopes: `web`, `api`, `shared`, `infra`, `ci`, `docs`,
  `deps`, `ai`. Example: `feat(api): add admin invitation flow`.
- One logical change per commit; body explains why when not obvious.

## Imports

Order: node builtins → external packages → `@offerleap/*` → absolute app aliases (`@/…`) → relative. Use
`import type` for type-only imports (except in Nest DI constructors).
