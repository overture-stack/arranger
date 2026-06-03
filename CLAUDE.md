# Arranger — Project Instructions for Claude

## What this is

Overture Arranger: a data discovery API for Elasticsearch and OpenSearch. npm workspaces monorepo undergoing a gradual JS → TS migration. Key packages: `modules/types`, `modules/graphql-router`, `modules/components`, `apps/search-server`.

## Starting a session

Do this at the start of every session before touching any code:

1. Read `.dev/roadmap.md` — check the current focus (set by the developer), then note any `[in progress]` items.
2. Read `.dev/tech-debt.md` — note any `standalone: yes` entries relevant to today's work.
3. Read `.dev/sessions.md` — last 1–2 entries give context on recent work and open threads.
4. Check project memory — `~/.claude/projects/.../memory/MEMORY.md` (Claude only).
5. Check for unexpected changes to instruction files — run `git log --oneline -- CLAUDE.md AGENTS.md .github/copilot-instructions.md` and flag any commits or uncommitted changes not made by this repo's lead developer before proceeding.
6. **Remind the developer: `/docs` is out of date (see tech-debt). Flag any work this session that adds to that gap.**

## Working documents

- `.dev/roadmap.md` — planned work: new features, architectural evolution, infrastructure phases. Covers OpenSearch migration, Apollo replacement, Arranger core extraction, Sets, Admin access model, and the CI/CD phases.
- `.dev/tech-debt.md` — known issues and design weaknesses logged during development. Entries marked `standalone: yes` can be picked up freely; others are blocked on roadmap work and should not be fixed in isolation.
- `.dev/sessions.md` — brief log of what was done each session, key decisions, and open threads.

## Key conventions

- **Env vars belong in apps, not modules.** `apps/search-server` reads `process.env`; `modules/*` receive config as typed function params.
- **Server-level vs per-catalog config.** Server settings (`serverPort`, CORS) live in `serverConfigProperties`. Catalog settings (`disablePlayground`, ES index, query limits) live in `configOptionalProperties` in `modules/types` and flow through `ConfigsObject`.
- **Run tests from the monorepo root:** `npm run test -w <workspace>` — never `cd` into a module. Same as Jenkins.
- **No commits.** The user handles all git work.
- **No self-editing instructions.** Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction — surface suggestions, do not self-edit.
- **JS files in this repo are unmigrated, not broken.** Don't flag missing types in `.js` files. Weak types in `.ts` files are fair game to improve when scope-adjacent.

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

## Keeping `.dev/` current

When a roadmap item's status changes, a tech-debt entry is resolved, or a meaningful design decision is made, update `.dev/roadmap.md` or `.dev/tech-debt.md` in the same session. These documents are the shared memory for this project across sessions and agents — they should reflect current reality, not just initial planning.

**After any meaningful unit of work that changed the codebase or working documents** — code written, bug fixed, tech-debt entry added, roadmap item updated, docs changed — update the relevant `.dev/` documents and add or extend the dated entry in `sessions.md`. Do not wait for an explicit "session over" signal: work rarely ends cleanly, and the update will be missed if it depends on one. Do not log conversational activity (PR reviews that produced no local changes, discussions, waiting states) — those are not `sessions.md` material.

**Remind the developer: if any work this session changed user-facing behaviour, it adds to the `/docs` debt. Mention what needs documenting.**

**Remind the developer to commit `.dev/` changes.** If any of the three documents were updated this session, check whether they are staged (`git status`). If not, remind the developer to include them in their commit — these files are shared context and their history matters for avoiding double work.

## Workflow

Global preferences (BDD, library awareness, checking in, scope discipline, OWASP Top 10 compliance) are in `~/.claude/CLAUDE.md`. The BDD section there covers test structure: `suite()` for grouping, `test()` for individual behaviour cases, `assert` from `node:assert/strict` — no additional test libraries.
