# Copilot Instructions — Arranger

## Project
GraphQL/Elasticsearch search API + React component library. npm workspaces monorepo, gradual JS → TS migration.

## Key files to read
- `.dev/roadmap.md` — all planned work: new features, architectural direction (OpenSearch-first, away from Apollo, Arranger core module), CI/CD phases
- `.dev/tech-debt.md` — known issues; `standalone: yes` entries can be picked up freely, others are blocked on roadmap work
- `.dev/sessions.md` — recent session log; read the last entry or two before starting work

## Keeping `.dev/` current
Update `.dev/roadmap.md` or `.dev/tech-debt.md` whenever a roadmap item's status changes, a debt entry is resolved, or a meaningful design decision is made. These are the shared memory for this project. After any meaningful unit of work that changed the codebase or working documents — code written, bug fixed, tech-debt entry added, roadmap item updated, docs changed — update both documents and add or extend the dated entry in `sessions.md`. Do not wait for an explicit "session over" signal. Do not log conversational activity (reviews that produced no local changes, discussions, waiting states).

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

## Conventions
- `modules/*` never read `process.env` — config comes in as function params from `apps/search-server`
- Per-catalog config (ES index, feature flags) uses `configOptionalProperties` from `modules/types`; server config (port, CORS) uses `serverConfigProperties` in `apps/search-server`
- `.js` files are pending migration — don't flag missing types in them
- Run tests from the monorepo root: `npm run test -w <workspace>`
- No commits — the developer handles git
