# Session Log

Brief record of what was done each session, key decisions made, and any open threads.
Not a changelog — that's git. This captures context and decisions that don't live in code.
Newest first.

---

## 2026-06-03

**Done:**

- Reviewed the Arize text-to-graphql-mcp reference implementation (tools: schema_management, graphql_helpers, query_construction, query_validation, query_optimization, query_execution, intent_recognition, data_visualization) against Arranger's current schema and MCP work.
- Added "MCP integration readiness" section to roadmap.md with three items: schema ETag/cache invalidation (high priority), SQON documentation in schema descriptions (medium), and field descriptions from ES mapping metadata (medium).
- Audited user-facing terminology across docs, config templates, and user-visible strings. Identified three inconsistency clusters: "folder" vs "directory" (directory is canonical), "settings" vs "configuration" (configuration for Arranger-level concepts, settings kept for ES-level), and the "Arranger Configs" page title (should be "Configuring Arranger").
- Created `docs/concepts.md`: standalone onboarding page covering the Arranger domain model (catalogues, configuration, facets/buckets/aggregations, filters/filter clauses/SQONs) with a canonical vocabulary reference table. Serves as the single source of truth for domain terminology across all agents and users.
- Added `sidebar_position` frontmatter to `docs/overview.md` (1), `docs/concepts.md` (2), and `docs/setup.md` (3) for correct Docusaurus ordering. Added "Next steps" pointer to `concepts.md` at the end of `overview.md`.
- Added vocabulary pointer line to `CLAUDE.md`, `AGENTS.md`, and `.github/copilot-instructions.md` pointing to `docs/concepts.md`.
- Added tech-debt entry in `tech-debt.md` covering the three terminology clusters with specific file/line references and a three-pass fix plan (docs pass, identifier rename pass, cross-reference pass).

**Decisions:**

- "filter clause" introduced as the precise term for a single `{op, content}` leaf node in a SQON; "filter" retained for the broader/lay sense.
- "settings" kept when mirroring Elasticsearch's own language (ES index settings); replaced with "configuration" for Arranger-level concepts.
- Em dashes excluded from all persisted file content (docs, code, comments, config) -- use regular dashes or rewrite.

---

## 2026-05-29

**Done:**

- Added `description` field to `configTemplates/configs.json.schema` — missed when PR #1070 ("add catalogue descriptions") shipped; the annotated schema is the primary human-readable reference for config operators.
- Fixed four factual errors in `/docs`: two stale GitHub links (`modules/server/configTemplates/` → `apps/search-server/configTemplates/`) in `02-arranger-components.md`; wrong key name `"index"` → `"esIndex"` in the base.json example; wrong key name `"active"` → `"isActive"` in the facets.json example.
- Updated repository structure tree in `docs/overview.md`: removed non-existent `modules/server/`, added `apps/` directory with `mcp-server` and `search-server`, expanded `modules/` to show all current packages, added `integration-tests/`, updated descriptions throughout.
- Added tech-debt entry for `setup.md` referencing `.env.arrangerDev` which no longer exists — left unfixed as the correct replacement process is unclear.
- Added three tech-debt entries under `## apps/mcp-server` in `tech-debt.md`: `InMemoryEventStore` not suitable for production (persistent store needed before production deployment); MCP session map does not evict abandoned transports (timestamp-based sweep approach noted); introspection types should be Zod-first so MCP output schemas can import directly from `search-server` rather than duplicating locally
- Updated `sessions.md` protocol in `~/.claude/CLAUDE.md`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and memory: `sessions.md` records only changes to code or working documents, not conversational activity
- Incorporated PR #1065 (MCP server scaffold) as merged into Dockerfile changes: added `apps/mcp-server` workspace to `Dockerfile.jenkins` scaffolding stage; added `mcp-server` Docker stage to both `Dockerfile.jenkins` and `Dockerfile.local`
- Renamed Docker stage `server` → `search-server` in both Dockerfiles — removes ambiguity now that two server images exist
- Rewrote `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy` (Phase 2 CI/CD work):
    - `turboBase` computed once from `GIT_PREVIOUS_COMMIT` (the commit Jenkins last built on this branch) with `HEAD^1` fallback for first builds — correctly covers multi-commit pushes to any branch, including direct pushes to main, without needing branch-specific logic; used for all change detection throughout the pipeline
    - Turbo build with `--filter=[turboBase]` replaces `npm run modules:build`; only affected packages and their dependents build
    - Turbo test with `--filter=[turboBase]` replaces five individual `npm run test -w` calls; `integration-tests/server` and `integration-tests/mcp-server` excluded from Turbo and handled separately
    - `integration-tests/server` runs conditionally — only when files in `sqon`, `types`, `graphql-router`, `apps/search-server`, or `integration-tests/server` changed since `turboBase`
    - Docker builds conditional per image: `search-server` image rebuilds when its server chain or Dockerfile changes; `mcp-server` image rebuilds when `apps/mcp-server`, shared modules, or Dockerfile changes; `POST_BUILD: Publish` parameter overrides and builds both
    - App versions (`searchServerVersion`, `mcpServerVersion`) read directly from `apps/*/package.json` in the Build stage — fixes pre-existing null bug where `versionsMap['server']` was used but `versionsMap` only covered `modules/*`
    - `TURBO_TELEMETRY_DISABLED=1` added to environment block
    - TEMP `release-charts` stage removed; `modules/charts` now covered by the standard release publish loop
    - Dead commented-out Slack notification code removed

**Decisions:**

- `fieldShape` outputSchema without `.parse()` is correct MCP usage — `outputSchema` is declarative for MCP clients, not runtime-enforced by the SDK
- Session eviction approach for `apps/mcp-server/src/http/app.ts`: track `lastSeenAt` per transport entry, sweep via `setInterval`, close and evict sessions idle beyond a configurable TTL (e.g. 30 min)
- `integration-tests/mcp-server` excluded from CI pipeline for now — needs full stack (ES + Arranger server + MCP server); design deferred
- `Deploy to overture-dev` stage left unchanged — infrastructure config for `arranger-iobio` must be updated separately to use the renamed `arranger-search-server` image

**Open threads:**

- `integration-tests/mcp-server` pipeline design: CI setup needs full stack — how to start and wait for Arranger + MCP server alongside ES
- Infrastructure deploy config: `arranger-iobio` deployment references the old `arranger-server` image name — needs updating in the infra repo

---

## 2026-05-28

**Done:**

- Removed `docker/**` and `docker-compose.yml` from `turbo.json` globalDependencies — those files don't affect TypeScript source so they were causing unnecessary cache busting; `tsconfig.eslint.json` remains
- Added `@overture-stack/arranger-types` as an explicit dependency in `modules/components/package.json` (`file:../types`) — without this, Turbo's graph treated `components` as independent of `types`, meaning a breaking change to `types` could pass CI without `components` being rebuilt or tested
- Corrected `modules/graphql-router/package.json` to use the shallower `file:../types` (was `file:../../modules/types` — unnecessarily traversing up to root and back down); `modules/types` already used the shallower `../sqon` convention; `apps/` and `integration-tests/` paths are already as shallow as their locations allow
- Completed items removed from roadmap (now in sessions only); roadmap stays forward-looking

**Decisions:**

- Charts CI goal: build and publish integration only — no test script needed; Turbo silently skips packages with no matching script, which is fine here
- lint/typecheck scripts across modules: deferred — not needed until Phase 4 CI gate work
- `next` Docker/NPM tagging: deferred to a later pass after core Turbo pipeline is working
- Charts to fold into the standard `release` publish loop; `TEMP. Publish Charts to NPM` stage to be removed
- Workflow: completed roadmap items are removed (not marked done) — sessions.md is the historical record; sessions entries should be self-contained descriptions, not references to numbered roadmap items

---

## 2026-05-27

**Done:**

- Fixed `/introspection/fields` correctness bug: each `arrangerRouter` instance now fetches the ES mapping once at startup, resolves live fields via `resolveCatalogueFields` (pure transform), and serves them from a local `GET /introspection` endpoint; `search-server` dispatches `/introspection/:catalogId` via URL rewriting; `catalogDetails.ts` deleted; logic lives in `graphql-router/src/introspection/buildCatalogueIntrospection.ts`
- Moved `fetchMapping`, `getESAliases`, `checkESAlias`, and `getIndexMapping` from `mapping/utils/` and `graphqlRoutes.ts` into `searchClient/fetchMapping.ts` — all ES I/O now in one layer
- Added `description` as an optional catalogue config property (`configOptionalProperties.DESCRIPTION` in `modules/types`) — surfaces in both the root `/introspection` response and the per-catalogue `/introspection/:catalogId` response via conditional spread (key absent when not configured, not `undefined`)
- Restructured `CatalogIntrospectionResponse`: removed `validOperators` from individual fields; added top-level `operators: Record<string, string[]>` keyed by field type; `buildFieldOperators()` in `buildCatalogueIntrospection.ts`
- Updated unit tests to match new shape; added coverage for `description` present/absent and `operators` deduplication

**Decisions:**

- `operators` (not `typeOperators`) — cleaner, consistent with existing "operators" vocabulary in SQON introspection
- `buildFieldOperators` (not `buildTypeOperators`) — "field operators" is the established naming family in `modules/sqon` (`SqonFieldOp`, `SqonFieldOperatorDetail`, `getSqonFieldOperatorDetails`)
- `description` on per-catalogue response too (not just root listing) — complete data at the endpoint; LLM context optimization is the MCP layer's responsibility
- `getValidOperators` → `modules/sqon` consolidation is out of scope: requires redesigning `applicableTo` data in `getSqonFieldOperatorDetails` (range types incorrectly include `filter`, `some-not-in`, `all` at present); separate roadmap item

**Open threads:**

- `getValidFieldOperators` → `modules/sqon` consolidation: follow-up when sqon consolidation roadmap item is picked up

---

## 2026-05-26

**Done:**

- Reviewed LLM model evaluation document (text-to-SQON benchmarking framework) as Arranger maintainers; provided technical commentary on fixtures, harness, scoring metrics, and model candidate list
- Identified that SQON fixture-001 uses `"value": [true]` which fails `SqonSchema.safeParse()` — `SqonScalarValueSchema` is `string | number` with no boolean; `"value": ["true"]` is the correct form
- Added two tech-debt entries: boolean values not accepted in SQON schema; `getValidOperators` and `getSqonFieldOperatorDetails` are divergent implementations of the same rules
- Added roadmap item: consolidate field-type-to-operator rules into `modules/sqon`
- Fleshed out `sqon-builder` absorption into `modules/sqon` as a detailed roadmap item: what to keep (builder API, `reduceSQON`, filter manipulation, `from()`), what to fix (operator coverage gap — only `in`/`gt`/`lt` today), what to leave behind (the `& SQON` anti-pattern), and migration path
- Added anchor links to all cross-references between `tech-debt.md` and `roadmap.md`

**Decisions:**

- `sqon-builder` is absorbed into `modules/sqon`, not the other way around — `modules/sqon` is the host; it grows to subsume `sqon-builder`'s builder API
- The `& SQON` type pattern in `sqon-builder` is a design mistake — explicitly named and documented as such; the correct design is a clean wrapper with explicit `toValue(): SqonNode` extraction
- Boolean values should be supported in SQON (not just string `"true"`); fix is additive — add `zod.boolean()` to `SqonScalarValueSchema`; confirmed this is an oversight, not deliberate
- The `/introspection/fields` endpoint is the canonical LLM context source — the evaluation document should reference it specifically rather than "GraphQL introspection"
- JSDoc/TSDoc should be added to functions and types as code is written or touched — not deferred to a documentation pass; inline docs are the safety net when `/docs` lags

**Open threads:**

- Boolean support in SQON schema: fix is clear but not yet implemented (two schema files, one in `sqon-builder`, one in `modules/sqon`)
- `reduceSQON` extension for full operator set needs deliberate design (e.g. what does reducing two `between` ranges under `and` mean?)

---

## 2026-05-21

**Done:**

- Added PR #1066 review feedback: type rename regression (`SupportedSearchClients` → `SupportedClientTypes` buried in wrong PR), dead validation code in `getNetworkPassthroughHeaders`, mutation-based normalize design, missing tests, `network.json` template bug (`[""]` vs `[]`), security note on all-or-nothing header passthrough, unrelated `integration-tests/import` change
- Added tech-debt: `SupportedSearchClients` rename regression risk (PR #1066), `esToAggTypeMap` duplication (once release-charts merges)
- Added tech-debt: inconsistent unit test file placement (`__tests__/` vs co-located) — global preference saved to memory and `~/.claude/CLAUDE.md`
- Added tech-debt: `/docs` out of date — marked urgent, reminder added to session start and end in both agent files
- Updated AGENTS.md and copilot-instructions.md: replaced OWASP category labels with 10 concrete code-level security triggers; removed external URL from agent files
- Updated DEVELOPMENT.md (user edit — admin-ui and integration-tests/admin removed from structure listing)
- Fixed sessions.md gap (root cause: reactive end-of-session trigger); backfilled missing entries for 2026-05-19 and 2026-05-20
- Updated session-end instruction in CLAUDE.md and AGENTS.md and copilot-instructions.md: changed from reactive ("at end of session") to proactive ("after any meaningful unit of work concludes")
- Added BDD migration guidance to all instruction files (`~/.claude/CLAUDE.md`, project `CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`) and memory: `suite()`/`test()` from `node:test`, `assert` from `node:assert/strict`, no additional libraries; migration is gradual — new tests BDD from start, existing tests nudged in scope

**Decisions:**

- Agent instruction files should use actionable inline triggers, not links to external docs — links incur unnecessary fetch cost for agents
- Test files must be co-located with source (`validation.test.ts` next to `validation.ts`), not in `__tests__/` folders — applies globally across all projects
- `/docs` updates are part of the definition of done for every feature — not a separate follow-up
- BDD pattern adopted using `node:test` primitives only (`suite`, `test`, `assert`) — no test library additions; `suite()` for grouping, `test()` for behaviour cases, matching the pattern already in use in `integration-tests/server/`

**Open threads:**

- Release gate script names (`release:test:packages` etc.) — proposed but not yet confirmed; roadmap items not yet added

---

## 2026-05-20

**Done:**

- Fixed duplicate `## search-server / graphql-router boundary` header in tech-debt.md
- Added roadmap item: config validation with structured errors and tests (Zod, standalone, not blocked on config separation)
- Added roadmap item: Admin UI replacement (low priority, coordinate with config separation)
- Added roadmap item: multicatalog catalog lifecycle and metadata (from `MULTICATALOG_ROADMAP.md` in search-server)
- Added multi-catalog filter composition bullet to Auth section in roadmap
- Created `DEVELOPMENT.md` at repo root — internal developer guide covering setup, repo structure, tests, `.dev/` working documents, and AI tooling

**Decisions:**

- `DEVELOPMENT.md` is the human-facing internal dev doc; `CONTRIBUTING.md` stays as the external/community-contributor doc
- Release gate script names should be declarative (describing scope, not speed): `release:test:packages`, `release:test:server`, `release:artifacts:verify` — pending confirmation before adding to roadmap

**Open threads:**

- Release gate script names (`release:test:packages` etc.) — proposed but not yet confirmed by Andy; roadmap items not yet added

---

## 2026-05-19

**Done:**

- Added 5 roadmap items: pin `turbo` as root devDependency, standardize publishable package contents (`files` allowlists), release gate scripts, multicatalog catalog lifecycle (later moved to 2026-05-20 session)
- Added docs reminder to tech-debt and session checklists (later formalized on 2026-05-21)
- Identified `aggsType` gap in charts pipeline: `ExtendedMappingInterface` lacks `aggsType`; `extendCharts.ts` is a stub; proposed 3-file fix (later found resolved in release-charts)

**Decisions:**

- `aggsType` should be computed server-side in `extendFields` (not client-side) — later superseded by release-charts fix

**Open threads:** `aggsType` gap analysis superseded — see 2026-05-20

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
