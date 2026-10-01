# Structure

```
offerleap/
├─ apps/
│  ├─ web/                      Next.js
│  │  ├─ messages/              vi.json, en.json
│  │  └─ src/
│  │     ├─ app/[locale]/       routes (auth, onboarding, dashboard, admin)
│  │     ├─ components/
│  │     │  ├─ atoms/ molecules/ organisms/ templates/
│  │     ├─ features/           feature-specific hooks and API calls
│  │     ├─ lib/                api client, cn(), formatters
│  │     ├─ i18n/               next-intl config
│  │     └─ styles/             tokens
│  └─ api/                      NestJS
│     ├─ prisma/                schema, migrations, seed
│     └─ src/
│        ├─ common/             filters, guards, decorators, pipes
│        ├─ config/             env schema
│        ├─ modules/<feature>/  module, controller, service, dto, processor
│        └─ main.ts
├─ packages/
│  └─ shared/src/               errors/, auth/, constants/, schemas/
├─ docs/
│  ├─ ai/                       guides for humans and AI assistants
│  └─ adr/                      architecture decisions
├─ .claude/                     skills, subagents, commands, settings
├─ AGENTS.md / CLAUDE.md
└─ docker-compose.yml
```

Rule: if both apps need it, it goes in `packages/shared`. If only one app needs it, it stays in that app.
