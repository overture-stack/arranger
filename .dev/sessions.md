# Session Log

Brief record of what was done each session, key decisions made, and any open threads.
Not a changelog — that's git. This captures context and decisions that don't live in code.
Newest first.

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
- Added 5 roadmap items: pin `turbo` as root devDependency, standardise publishable package contents (`files` allowlists), release gate scripts, multicatalog catalog lifecycle (later moved to 2026-05-20 session)
- Added docs reminder to tech-debt and session checklists (later formalised on 2026-05-21)
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
