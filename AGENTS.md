# Arranger — Agent Instructions

## Project

Overture Arranger: a data discovery API for Elasticsearch and OpenSearch.
npm workspaces monorepo. Gradual JS → TS migration in progress.

## Starting a session

Do this before touching any code:

1. Read `.dev/roadmap.md` — check the current focus (set by the developer at session start), then note any `[in progress]` items.
2. Read `.dev/tech-debt.md` — note any `standalone: yes` entries relevant to today's work.
3. Read `.dev/sessions.md` — last 1–2 entries give context on recent work and open threads.
4. **Remind the developer: `/docs` is out of date (see tech-debt). Flag any work this session that adds to that gap.**

## Working documents

- `.dev/roadmap.md` — all planned work: new features (Sets, Admin access model), architectural evolution (OpenSearch-first, Apollo replacement, Arranger core module extraction, transport abstraction), and CI/CD phases. Authoritative picture of where the project is going.
- `.dev/tech-debt.md` — known issues found during development. Entries marked `standalone: yes` can be addressed freely. Entries marked `needs-context` or tied to roadmap items should not be fixed in isolation — read the linked roadmap entry first.
- `.dev/sessions.md` — brief log of what was done each session, key decisions, and open threads.

## Structure

```
modules/types          — shared TS types and constants (@overture-stack/arranger-types)
modules/graphql-router — GraphQL/Apollo server, Elasticsearch integration
modules/components     — React UI components
modules/sqon           — SQON query builder
apps/search-server     — main server application
integration-tests/     — server (needs ES), import, admin
```

## Conventions

**Env vars:** Only `apps/search-server/src/configs/fromEnv/localEnvs.ts` reads `process.env`. Modules receive config as typed function parameters — never `process.env` inside `modules/*`.

**Config levels:**

- Server-level (port, CORS): `serverConfigProperties` in `apps/search-server/src/configs/types/constants.ts`
- Per-catalog (ES index, feature flags, query limits): `configOptionalProperties` in `modules/types/src/configs/constants.ts`, typed in `ConfigsObject`

**TypeScript migration:** `.js` files are not yet migrated — don't treat missing types in them as issues. Weak types in `.ts` files are worth improving when scope-adjacent.

**Config properties:** Alphabetize properties in config objects and YAML/JSON files at all nesting levels — prevents duplicate key overwrites and keeps additions consistent.

**Search before writing:** Grep for existing patterns before implementing something new — keeps code consistent and surfaces reusable utilities.

**Structured logging:** Emit logs as structured key-value pairs or JSON objects, not interpolated strings. Include: timestamp, severity, event type, actor identity where known, resource identifier, outcome. Never log secrets, credentials, or PII. Mandatory for auth decisions, permission changes, data access/exports, and errors at system boundaries.

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

## Running tests

Always from the monorepo root:

```
npm run test -w modules/graphql-router   # single workspace
npm run test:dev                          # all dev-relevant workspaces
```

Never `cd` into a module and run `npm test` directly.

New tests use BDD style: `suite()` for grouping, `test()` for expected behaviour, `assert` from `node:assert/strict` — no additional libraries. See [conventions/testing.md in agentics](https://github.com/oicr-softeng/agentics/blob/main/template/conventions/testing.md) for the full pattern.

## Session discipline

After any meaningful unit of work, update `.dev/` and extend the dated entry in `sessions.md`. Do not wait for a session-over signal. Do not log conversational activity. Remind the developer to commit `.dev/` changes.

Full rules: [conventions/session-discipline.md in agentics](https://github.com/oicr-softeng/agentics/blob/main/template/conventions/session-discipline.md).

## Security triggers

The baseline OWASP patterns, threat model, and general code review triggers live in `conventions/security-guidelines.md` in the [agentics template](https://github.com/oicr-softeng/agentics). The triggers below are Arranger-specific additions on top of that baseline.

Check these as you write or review code. Flag violations rather than silently skipping them.

- **No stack traces or internal details in API responses.** GraphQL error messages sent to clients must not include stack traces, ES index names, file paths, or library versions. Log them server-side only.
- **GraphQL introspection and field suggestions off in production.** When `disablePlayground` is true or the environment is not local dev, introspection and field suggestions should be explicitly disabled.
- **Query depth and alias limits must be configured.** `GRAPHQL_MAX_DEPTH` and `GRAPHQL_MAX_ALIASES` must be set — omitting them allows DoS via deeply nested or aliased queries.
- **Validate user-provided field names before forwarding to ES.** SQON field names and any user input forwarded into ES query bodies must be validated against the known index mapping. Unvalidated field names are an injection vector.
- **No credentials or tokens in logs.** `ES_PASS`, `Authorization` header values, and bearer tokens must not appear in log output at any level, including debug.
- **HTTP remote nodes with forwarded auth headers leak credentials.** If `passthroughHeaders` includes an auth header and a remote `graphqlUrl` uses `http://` on a non-localhost host, flag it.
- **CORS wildcard is a misconfiguration outside local dev.** `allowedCorsOrigins: ['*']` must not appear in any config intended for a deployed environment.
- **`enableDebug` and `enableAdmin` must default to `false`.** Flag any code path that enables these without an explicit opt-in. Their defaults in `featureFlagDefaults` should be `false`.
- **Aggregate counts from sensitive catalogs may need suppression.** Before returning aggregation results from a catalog that may contain sensitive or re-identifiable data, check whether count suppression is configured (see roadmap).
- **`passthroughHeaders` entries must be non-empty strings.** An empty string passes current type validation but attempts to forward a header with no name — validate all entries are non-empty before use.

## Language

Canadian English throughout (catalogue, behaviour, centre, organize, analyse). Flag typos and spelling issues — don't fix silently; call them out so the developer can decide.

## Workflow

Plan before implementing. For logic with clear inputs/outputs, define behaviour as tests before implementation (BDD). Stick to scope — document adjacent issues in `.dev/tech-debt.md`. Surface well-established library options when relevant. Check in before non-trivial direction changes.

Project-specific conventions belong here. Universal conventions (scope discipline, library awareness, checking in, convention placement and propagation) are in the [agentics template AGENTS.md](https://github.com/oicr-softeng/agentics/blob/main/template/AGENTS.md).

## Critical constraints

- No commits — the user handles all git work.
- Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction. Surface suggestions; do not self-edit.
