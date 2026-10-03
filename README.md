# OfferLeap

**Make the Leap. Land the Offer.**

OfferLeap is an AI-powered job application assistant. Upload your CV (PDF, DOCX or image) and the AI fills in your
profile, scores your CV against a job description, runs mock interviews and drafts cover letters — in Vietnamese or
English.

> 🚧 Work in progress — see the [roadmap](docs/roadmap.md).

## Tech stack

| Area    | Tech                                                                                |
| ------- | ----------------------------------------------------------------------------------- |
| Web     | Next.js (App Router), React, Tailwind CSS, next-intl — custom atomic-design UI      |
| API     | NestJS, Prisma, PostgreSQL + pgvector, BullMQ + Redis                               |
| AI      | Anthropic Claude (structured outputs, streaming, document & vision input)           |
| Shared  | `@offerleap/shared` — error codes, roles, schemas used by both apps                 |
| Tooling | pnpm workspaces, Turborepo, TypeScript, ESLint, Prettier, Vitest, Husky, commitlint |
| Infra   | Docker Compose (Postgres, Redis, Mailpit), GitHub Actions                           |

## Getting started

Prerequisites: Node.js 24 (`nvm use`), pnpm 12 (`npm i -g pnpm@12`), Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up        # Postgres :5432, Redis :6379, Mailpit UI :8025
pnpm dev             # web http://localhost:3000 · api http://localhost:4000/api/v1/health
```

## Scripts

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Run all apps in watch mode                  |
| `pnpm build`     | Build all packages and apps                 |
| `pnpm lint`      | ESLint across the monorepo                  |
| `pnpm typecheck` | TypeScript checks                           |
| `pnpm test`      | Unit tests (Vitest)                         |
| `pnpm storybook` | Component explorer on http://localhost:6006 |
| `pnpm format`    | Prettier                                    |

## Project structure

```
apps/web          Next.js frontend
apps/api          NestJS backend
packages/shared   Contracts shared by web and api
docs/ai           Architecture, conventions, best practices
docs/adr          Architecture Decision Records
```

## Working with AI assistants

The repo ships guides for AI coding assistants: [`AGENTS.md`](AGENTS.md) (tool-agnostic entry point),
[`CLAUDE.md`](CLAUDE.md), and `.claude/` with project skills, review subagents and commands.

## License

[MIT](LICENSE)
