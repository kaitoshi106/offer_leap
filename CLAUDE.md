@AGENTS.md

## Claude Code specifics

- Project skills live in `.claude/skills/` — use them for the matching task (new component, Nest module, i18n keys,
  Prisma migration, prompt change).
- Review subagents live in `.claude/agents/` (`code-reviewer`, `a11y-auditor`, `security-reviewer`).
- Before claiming a task is done, run `pnpm lint && pnpm typecheck && pnpm test` and report the real output.
- Personal overrides go in `CLAUDE.local.md` / `.claude/settings.local.json` (git-ignored).
