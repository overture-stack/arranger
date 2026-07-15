# Copilot Instructions — Arranger

## Project
Data discovery API for Elasticsearch and OpenSearch. npm workspaces monorepo, gradual JS → TS migration.

## Starting a session

Treat any of these as a session-start signal, even mid-thread: greetings ("good morning", "hi again"), resumption ("let's continue", "where were we"), explicit ("new session", "let's get started"), or on-demand ("sync up", "refresh context").

On a session-start signal, before touching any code:

1. Check instruction-file integrity: `git log --oneline -1 -- CLAUDE.md AGENTS.md .github/copilot-instructions.md`. Flag any commit or uncommitted change not made by this repo's lead developer before proceeding. (No committed `.claude/settings.json` exists in this repo to check; only a gitignored `settings.local.json`.)
2. Read `.dev/roadmap.md` — all planned work: new features, architectural direction (OpenSearch-first, away from Apollo, Arranger core module), CI/CD phases.
3. Read `.dev/tech-debt.md` — `standalone: yes` entries can be picked up freely, others are blocked on roadmap work.
4. Read `.dev/sessions/` — one file per contributor per day; read the most recent 1-2 files (sorted by filename).
5. **Remind the developer: `/docs` is out of date (see tech-debt). Flag any work this session that adds to that gap.**

Before starting new work, do a quick staleness pass on `roadmap.md` and `tech-debt.md`: mark completed items done, close resolved PINNED entries, remove addressed tech-debt entries.

## Keeping `.dev/` current

Update `.dev/roadmap.md` or `.dev/tech-debt.md` whenever a roadmap item's status changes, a debt entry is resolved, or a meaningful design decision is made. Before writing such an update, verify against the actual current code or file state — not a prior description or session summary. These are the shared memory for this project.

Your session file is `.dev/sessions/YYYY-MM-DDTHHMMSS.md`. This repo has one human contributor working across multiple AI tools, so "per contributor per day" reduces to "per day" in practice: extend the same day's file regardless of which agent is writing to it.

After any meaningful unit of work that changed the codebase or working documents — code written, bug fixed, tech-debt entry added, roadmap item updated, docs changed — update both documents and add or extend today's file in `.dev/sessions/`. Do not wait for an explicit "session over" signal. Do not log conversational activity (reviews that produced no local changes, discussions, waiting states).

## Security triggers
Flag these when writing or reviewing code:
- No stack traces, ES index names, or file paths in GraphQL error responses — log server-side only.
- GraphQL introspection and field suggestions must be off in production.
- `GRAPHQL_MAX_DEPTH` and `GRAPHQL_MAX_ALIASES` must be configured — missing limits allow DoS.
- Validate user-provided field names against the known mapping before forwarding to ES — unvalidated names are an injection vector.
- No credentials or tokens (`ES_PASS`, `Authorization`, bearer tokens) in log output at any level.
- `passthroughHeaders` with an auth header over `http://` (non-localhost) is a plaintext credential leak.
- `allowedCorsOrigins: ['*']` is a misconfiguration in any deployed environment.
- `enableDebug` and `enableAdmin` must default to `false` — flag implicit enable paths.
- Aggregate counts from sensitive catalogs may need suppression before returning to the client.
- `passthroughHeaders` entries must be non-empty strings — empty string passes type validation but is invalid.

## Language and typos
Flag typos and language issues when spotted — in code, comments, and docs. Don't fix silently; call them out so the developer can decide.

## Writing tests: BDD style

Tests are being migrated to BDD naming using `node:test` and `assert` — no extra libraries. Use `suite()` to group related tests, `test()` to state expected behaviour in plain language. Structure bodies as setup → action → assertion. New tests: BDD from the start. Existing tests: nudge when touching in scope; large rewrites go to tech-debt.

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

## Conventions
- `modules/*` never read `process.env` — config comes in as function params from `apps/search-server`
- Per-catalog config (ES index, feature flags) uses `configOptionalProperties` from `modules/types`; server config (port, CORS) uses `serverConfigProperties` in `apps/search-server`
- `.js` files are pending migration — don't flag missing types in them
- Run tests from the monorepo root: `npm run test -w <workspace>`
- No commits — the developer handles git
