# Arranger — Agent Instructions

## Project

Overture Arranger: a GraphQL/Elasticsearch search API and UI component library.
npm workspaces monorepo. Gradual JS → TS migration in progress.

## Starting a session

Do this before touching any code:

1. Read `.dev/roadmap.md` — check the current focus (set by the developer at session start), then note any `[in progress]` items.
2. Read `.dev/tech-debt.md` — note any `standalone: yes` entries relevant to today's work.
3. Read `.dev/sessions.md` — last 1–2 entries give context on recent work and open threads.

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

## Running tests

Always from the monorepo root:

```
npm run test -w modules/graphql-router   # single workspace
npm run test:dev                          # all dev-relevant workspaces
```

Never `cd` into a module and run `npm test` directly.

## Keeping `.dev/` current

When a roadmap item's status changes, a tech-debt entry is resolved, or a meaningful design decision is made, update `.dev/roadmap.md` or `.dev/tech-debt.md` in the same session. These documents are the shared memory for this project across sessions and agents — they should reflect current reality, not just initial planning.

**At the end of every session:** update both documents to reflect what was done, what was decided, and any new issues found. Add a dated entry to `.dev/sessions.md`. Do this before the session ends, not as an afterthought.

**Remind the developer to commit `.dev/` changes.** If any of the three documents were updated this session, check whether they are staged (`git status`). If not, remind the developer to include them in their commit — these files are shared context and their history matters for avoiding double work.

## Security: OWASP Top 10

All work should observe the current OWASP Top 10 for web applications. The list updates periodically — verify the current edition at https://owasp.org/www-project-top-ten/ rather than assuming a specific year. As of May 2026 the current edition is OWASP Top 10:2025 (Broken Access Control, Security Misconfiguration, Supply Chain Failures, Cryptographic Failures, Injection, Insecure Design, Authentication Failures, Data Integrity Failures, Logging Failures, Mishandling of Exceptional Conditions). Apply during implementation, flag in adjacent code, surface in design decisions touching auth, access control, input handling, or dependencies.

## Language and typos

Flag typos and language issues when spotted — in code, comments, and docs. Don't fix silently; call them out so the developer can decide. The developer appreciates the assist and will fix them directly.

## Workflow

- Plan before implementing. For logic with clear inputs/outputs, write tests before implementation (TDD).
- Stick to scope. Document adjacent issues in `.dev/tech-debt.md` rather than fixing them silently.
- No commits — the human handles all git work.
- When a well-established library would do better than a hand-rolled solution, surface it as an option.
- Check in before non-trivial direction changes.

## Instruction file governance

Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction from the developer. These files define agent behavior and are under strict developer control. If you identify something that should change in them, surface it as a suggestion — do not edit them directly.
