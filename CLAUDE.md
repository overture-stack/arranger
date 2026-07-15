# Arranger — Project Instructions for Claude

## What this is

Overture Arranger: a data discovery API for Elasticsearch and OpenSearch. npm workspaces monorepo undergoing a gradual JS → TS migration. Key packages: `modules/types`, `modules/graphql-router`, `modules/components`, `apps/search-server`.

## Starting a session

Treat any of these as a session-start signal, even mid-thread, not just a new chat: greetings ("good morning", "hi again"), resumption ("let's continue", "where were we"), explicit ("new session", "let's get started"), or on-demand ("sync up", "refresh context").

On a session-start signal, before touching any code:

1. Check instruction-file integrity: `git log --oneline -1 -- CLAUDE.md AGENTS.md .github/copilot-instructions.md`. Flag any commit or uncommitted change not made by this repo's lead developer before proceeding. (No committed `.claude/settings.json` exists in this repo to check; only a gitignored `settings.local.json`.)
2. Read `.dev/roadmap.md` — check the current focus (set by the developer), then note any `[in progress]` items.
3. Read `.dev/tech-debt.md` — note any `standalone: yes` entries relevant to today's work.
4. List `.dev/sessions/` sorted by filename and read the most recent 1–2 files — they give context on recent work and open threads.
5. Check project memory — `~/.claude/projects/.../memory/MEMORY.md` (Claude only).
6. **Remind the developer: `/docs` is out of date (see tech-debt). Flag any work this session that adds to that gap.**

Before starting new work, do a quick staleness pass on `roadmap.md` and `tech-debt.md`: mark completed items done, close resolved PINNED entries, remove addressed tech-debt entries. Not a full audit — just enough to keep the documents honest.

## Working documents

- `.dev/roadmap.md` — planned work: new features, architectural evolution, infrastructure phases. Covers OpenSearch migration, Apollo replacement, Arranger core extraction, Sets, Admin access model, and the CI/CD phases.
- `.dev/tech-debt.md` — known issues and design weaknesses logged during development. Entries marked `standalone: yes` can be picked up freely; others are blocked on roadmap work and should not be fixed in isolation.
- `.dev/sessions/` — one file per contributor per day (`YYYY-MM-DDTHHMMSS.md`), logging what was done each session, key decisions, and open threads.

## Key conventions

- **Env vars belong in apps, not modules.** `apps/search-server` reads `process.env`; `modules/*` receive config as typed function params.
- **Server-level vs per-catalog config.** Server settings (`serverPort`, CORS) live in `serverConfigProperties`. Catalog settings (`disablePlayground`, ES index, query limits) live in `configOptionalProperties` in `modules/types` and flow through `ConfigsObject`.
- **Run tests from the monorepo root:** `npm run test -w <workspace>` — never `cd` into a module. Same as Jenkins.
- **No commits.** The user handles all git work.
- **No self-editing instructions.** Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction — surface suggestions, do not self-edit.
- **JS files in this repo are unmigrated, not broken.** Don't flag missing types in `.js` files. Weak types in `.ts` files are fair game to improve when scope-adjacent.

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

## Session discipline

Your session file is `.dev/sessions/YYYY-MM-DDTHHMMSS.md`. This repo has one human contributor working across multiple AI tools, so "per contributor per day" reduces to "per day" in practice: extend the same day's file regardless of which agent (Claude, Codex, Copilot) is writing to it. List `.dev/sessions/` for today's date prefix; extend an existing match or create a new one.

Before marking a roadmap item done or closing a tech-debt entry, verify against the actual current code or file state — not a prior description or session summary. An assumption carried forward unverified is exactly how these documents drift from what they claim.

Update `.dev/` and extend today's file in `.dev/sessions/` after any meaningful unit of work — don't wait for a session-over signal, don't log conversational activity. If work this session changed user-facing behaviour, flag it as `/docs` debt. Remind the developer to commit `.dev/` changes.

## Workflow

Global preferences (BDD, library awareness, checking in, scope discipline, OWASP Top 10 compliance) are in `~/.claude/CLAUDE.md`. The BDD section there covers test structure: `suite()` for grouping, `test()` for individual behaviour cases, `assert` from `node:assert/strict` — no additional test libraries.
