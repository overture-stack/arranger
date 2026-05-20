# Session Log

Brief record of what was done each session, key decisions made, and any open threads.
Not a changelog — that's git. This captures context and decisions that don't live in code.
Newest first.

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
