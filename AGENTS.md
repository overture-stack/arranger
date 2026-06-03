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

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

## Running tests

Always from the monorepo root:

```
npm run test -w modules/graphql-router   # single workspace
npm run test:dev                          # all dev-relevant workspaces
```

Never `cd` into a module and run `npm test` directly.

## Keeping `.dev/` current

When a roadmap item's status changes, a tech-debt entry is resolved, or a meaningful design decision is made, update `.dev/roadmap.md` or `.dev/tech-debt.md` in the same session. These documents are the shared memory for this project across sessions and agents — they should reflect current reality, not just initial planning.

**After any meaningful unit of work that changed the codebase or working documents** — code written, bug fixed, tech-debt entry added, roadmap item updated, docs changed — update the relevant `.dev/` documents and add or extend the dated entry in `sessions.md`. Do not wait for an explicit "session over" signal: work rarely ends cleanly, and the update will be missed if it depends on one. Do not log conversational activity (PR reviews that produced no local changes, discussions, waiting states) — those are not `sessions.md` material.

**Remind the developer: if any work this session changed user-facing behaviour, it adds to the `/docs` debt. Mention what needs documenting.**

**Remind the developer to commit `.dev/` changes.** If any of the three documents were updated this session, check whether they are staged (`git status`). If not, remind the developer to include them in their commit — these files are shared context and their history matters for avoiding double work.

## Security triggers

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

## Language and typos

Flag typos and language issues when spotted — in code, comments, and docs. Don't fix silently; call them out so the developer can decide. The developer appreciates the assist and will fix them directly.

## Workflow

- Plan before implementing. For logic with clear inputs/outputs, define behaviour as tests before implementation (BDD).
- Stick to scope. Document adjacent issues in `.dev/tech-debt.md` rather than fixing them silently.
- No commits — the human handles all git work.
- When a well-established library would do better than a hand-rolled solution, surface it as an option.
- Check in before non-trivial direction changes.

## Writing tests: BDD style

Tests are being migrated toward a BDD naming pattern using `node:test` and `assert` — no additional libraries. Apply this for new tests; nudge existing tests toward it when touching them in scope.

- `suite()` groups related tests: `suite('getNetworkPassthroughHeaders', ...)`
- `test()` states expected behaviour: `test('returns an empty array when no headers are configured', ...)`
- Structure bodies as setup → action → assertion (Given / When / Then)

```ts
import { suite, test } from 'node:test';
import assert from 'node:assert/strict';

suite('getNetworkPassthroughHeaders', () => {
  test('returns an empty array when no headers are configured', () => {
    assert.deepEqual(getNetworkPassthroughHeaders({ passthroughHeaders: [] }), []);
  });
});
```

Large-scale rewrites of existing tests belong in tech-debt, not done out of scope.

## Instruction file governance

Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction from the developer. These files define agent behavior and are under strict developer control. If you identify something that should change in them, surface it as a suggestion — do not edit them directly.
