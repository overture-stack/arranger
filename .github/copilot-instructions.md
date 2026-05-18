# Copilot Instructions — Arranger

## Project
GraphQL/Elasticsearch search API + React component library. npm workspaces monorepo, gradual JS → TS migration.

## Key files to read
- `.dev/roadmap.md` — all planned work: new features, architectural direction (OpenSearch-first, away from Apollo, Arranger core module), CI/CD phases
- `.dev/tech-debt.md` — known issues; `standalone: yes` entries can be picked up freely, others are blocked on roadmap work
- `.dev/sessions.md` — recent session log; read the last entry or two before starting work

## Keeping `.dev/` current
Update `.dev/roadmap.md` or `.dev/tech-debt.md` whenever a roadmap item's status changes, a debt entry is resolved, or a meaningful design decision is made. These are the shared memory for this project. At the end of every session, update both documents to reflect what was done and any new issues found.

## Security: OWASP Top 10
Observe the current OWASP Top 10 (https://owasp.org/www-project-top-ten/ — verify the edition is current). As of May 2026: OWASP Top 10:2025. Apply during implementation and flag issues in adjacent code.

## Language and typos
Flag typos and language issues when spotted — in code, comments, and docs. Don't fix silently; call them out so the developer can decide.

## Conventions
- `modules/*` never read `process.env` — config comes in as function params from `apps/search-server`
- Per-catalog config (ES index, feature flags) uses `configOptionalProperties` from `modules/types`; server config (port, CORS) uses `serverConfigProperties` in `apps/search-server`
- `.js` files are pending migration — don't flag missing types in them
- Run tests from the monorepo root: `npm run test -w <workspace>`
- No commits — the developer handles git
