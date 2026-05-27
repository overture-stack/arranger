# Session Log

Brief record of what was done each session, key decisions made, and any open threads.
Not a changelog — that's git. This captures context and decisions that don't live in code.
Newest first.

---

## 2026-05-26

**Done:**
- Added `integration-tests/mcp-server` workspace with end-to-end tests for `apps/mcp-server`
  - Spins up Arranger search-server in-process (multicatalog mode) with two test catalogs, then starts the MCP server pointed at it, then drives it over Streamable HTTP via the official MCP SDK Client
  - Connection assertion is implicit: `validateArrangerConnection` runs before `app.listen`, so the suite reaching the test phase proves the MCP→Arranger contract works
  - Test coverage: spinup/active (ping, capabilities, resource/tool listings), MCP resources (`arranger://introspection/server`, `arranger://introspection/sqon`, `arranger://introspection/catalog/{id}` via template), MCP tools (`list-catalogs`, `get-sqon-schema`, `get-catalog-fields` happy + 404 paths)
  - 13 tests in 4 suites; runs against the same local ES used by `integration-tests/server`
- Added `integration-tests/mcp-server` to the root `package.json` workspaces list

**Decisions:**
- Backend: spin up search-server in-process (mirrors `integration-tests/server`), not external nor mocked — keeps the harness self-contained while exercising the real Arranger contract.
- Coverage: multicatalog only — exercises the catalog resource template and `list-catalogs` with >1 catalog. Single-catalog is a subset and not worth doubling runtime for.
- Catalog field introspection (`/introspection/{catalogId}`) reads from `catalogConfigs.extended`, which is empty in the existing `integration-tests/server` multiconfigs. New fixtures under `integration-tests/mcp-server/multiconfigs/` include populated `extended` arrays so the tests can assert real field metadata.
- Test files live under `test/` and the entry point is `test/index.test.ts`. Node 24's test runner auto-discovers `.ts` files in `test/`; node 20 does not, so this suite requires node 24+ (consistent with the project's `engines.node >= 20` but practically aligned with the dev shell setup).
- Lazy MCP client access via `getClient: () => Client` — `node:test` suite factories run at registration time, before `before()` hooks have populated state. Each test resolves the client when it actually runs.

**Open threads:**
- Single-catalog coverage is not exercised; can be added if MCP server adds single-catalog-specific behavior (currently it doesn't differentiate).
- Negative test for `validateArrangerConnection` failure on startup is covered by unit tests (`apps/mcp-server/src/arranger/validation.test.ts`); not duplicated as an integration test because the production startup path calls `process.exit(1)`, which is awkward to exercise in-process.

---

## 2026-05-18

**Done:**
- Fixed `SearchClient`/`Client` type mismatch in `apps/search-server/src/arrangerRoutes.ts`
- Created `.dev/sessions.md` (this file)
- Fleshed out roadmap with ~20 new items across Architecture, Features, Components (new section), Security, Deployment (new section), and CI/CD
- Added 6 items to tech-debt (2 urgent bugs: stack traces in responses, introspection in production; plus Quicksearch regex risk, release-charts cleanup, and 2 UI bugs)
- Added OWASP Top 10:2025 compliance to global `~/.claude/CLAUDE.md` and project agent files
- Read Jenkins pipeline; updated CI/CD roadmap context with actual branching model and versioning intent

**Decisions:**
- Emoji should be adornment only — no semantic meaning in docs or markers
- "Current focus" in roadmap is the developer's responsibility at session start
- `0.0.0-dev` in main is intentional — versioning is a release-branch concern, not a dev concern
- "edge"→"next" is a Docker image tag change; NPM `next` from main is a separate decision
- Emotion replacement gates theming engine extension — decide Radix/ShadCN first
- Config separation blocked on core extraction; Zod validation follows from that
- hits/edges/nodes redesign should be designed alongside core extraction
- Schema versioning strategy must be decided before redesign work starts
- Facet sort order persistence deferred until Admin/auth model is defined
- nx is a Turbo alternative, not a complement — Turbo + pnpm remains the plan
- Bugs go to tech-debt, not roadmap

**Open threads:** none — NPM `next` from main confirmed as desired; captured in Phase 2.4

---

## 2026-05-16

**Done:**
- Implemented GraphQL alias/depth DoS protection: `maxAliasesRule` and `maxDepthRule` in `modules/graphql-router/src/utils/queryValidation.ts`
- Wired limits as per-catalog config via `configOptionalProperties` (`GRAPHQL_MAX_ALIASES`, `GRAPHQL_MAX_DEPTH`) and `ConfigsObject` in `modules/types`
- Env var reading added to `apps/search-server/src/configs/fromEnv/localEnvs.ts`
- 10 unit tests added in `modules/graphql-router/src/utils/__tests__/queryValidation.test.ts`
- Built out `.dev/roadmap.md` and `.dev/tech-debt.md` from scratch

**Decisions:**
- GraphQL query limits are per-catalog config, not server-level — they tune per-index behaviour
- graphql-yoga is the research-confirmed candidate to replace Apollo Server (not a final decision)
- sqon-builder should be integrated into this monorepo — roadmap item added

**Open threads:** none
