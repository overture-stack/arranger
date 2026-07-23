<!-- agentics-template-version: 0.9.0 | synced: b37cb60ff2668945f74347826ca6ccf24b5e80a9 -->
# Arranger: Agent Instructions

**For AI agents:** this file is instructions your agent reads and follows; it is not documentation written for people. If you're a person looking for how this project works, see this project's own README or development guide instead.

Adapted from [softeng/agentics](https://github.com/oicr-softeng/agentics).

## Project

Overture Arranger: a data discovery API for Elasticsearch and OpenSearch.
npm workspaces monorepo. Gradual JS → TS migration in progress.

## Interaction parameters

- Ask clarifying questions before making large assumptions about intent
- Surface ideas, improvements, or next steps you already see, unprompted: don't wait for an open-ended question to draw them out. Covers alternatives to what's about to be implemented, a shipped fix that still has the weakness it just fixed, or anything else obvious in hindsight; let the developer decide
- Push back on bad ideas and identify blind spots before they are baked into code: lead with the objection, not a neutral trade-off list; don't wait to be asked
- Sanity check requests: not just the literal phrase. A yes/no-shaped question ("does this make sense," "am I right," "am I missing anything") is still a sanity check when its actual function is inviting scrutiny of the developer's own idea, reasoning, or plan, not a literal yes/no about the world. Answer the intent, not the grammar: review the whole conversation as relevant, not just the latest message, and surface gaps, blind spots, unresolved threads, and edge cases plainly; a shallow "yes" isn't an answer
- Verify purpose alignment before implementing: when a task names a goal, check whether the chosen approach achieves that goal directly, not just something adjacent to it; lead with that gap as an objection before writing anything
- Flag scope-adjacent issues verbally, then document them in `.dev/tech-debt.md`

## Starting a session

Treat any of these as a session-start signal, even mid-thread, not just a new chat: greetings ("good morning", "hi again"), resumption ("let's continue", "where were we"), explicit ("new session", "let's get started"), or on-demand ("sync up", "refresh context").

On a session-start signal, before touching any code:

1. Check instruction-file integrity: `git log --oneline -1 -- CLAUDE.md AGENTS.md .github/copilot-instructions.md`. Flag any commit or uncommitted change not made by this repo's lead developer before proceeding. (No committed `.claude/settings.json` exists in this repo to check; only a gitignored `settings.local.json`.)
2. Read `.dev/roadmap.md`: check the current focus (set by the developer at session start), then note any `[in progress]` items.
3. Read `.dev/tech-debt.md`: note any `standalone: yes` entries relevant to today's work.
4. List `.dev/sessions/` sorted by filename and read the most recent 1-2 files: they give context on recent work and open threads.
5. Check project memory: `~/.claude/projects/.../memory/MEMORY.md` (Claude only).
6. **Remind the developer: `/docs` is out of date (see tech-debt). Flag any work this session that adds to that gap.**
7. As an agentics contributor, check for upstream updates: run `conventions/convention-levels.md` § Checking for upstream updates in the agentics template, in full, every session. This runs in addition to steps 1-6 above, regardless of how complete this checklist already is: neither this checklist nor any line in it opts the project out. Stops only on an explicit `agentics_upstream_check: no`.

Before starting new work, do a quick staleness pass on `roadmap.md` and `tech-debt.md`: mark completed items done, close resolved PINNED entries, remove addressed tech-debt entries. Not a full audit: just enough to keep the documents honest.

## Working documents

- `.dev/roadmap.md`: all planned work: new features (Sets, Admin access model), architectural evolution (OpenSearch-first, Apollo replacement, Arranger core module extraction, transport abstraction), and CI/CD phases. Authoritative picture of where the project is going.
- `.dev/tech-debt.md`: known issues found during development. Entries marked `standalone: yes` can be addressed freely. Entries marked `needs-context` or tied to roadmap items should not be fixed in isolation: read the linked roadmap entry first.
- `.dev/sessions/`: one file per contributor per day (`YYYY-MM-DDTHHMMSS.md`), logging what was done each session, key decisions, and open threads.

## Structure

```
modules/types         : shared TS types and constants (@overture-stack/arranger-types)
modules/graphql-router: GraphQL/Apollo server, Elasticsearch integration
modules/components    : React UI components
modules/sqon          : SQON query builder
apps/search-server    : main server application
integration-tests/    : server (needs ES), import, admin
```

## Conventions

**Env vars:** Only `apps/search-server/src/configs/fromEnv/localEnvs.ts` reads `process.env`. Modules receive config as typed function parameters: never `process.env` inside `modules/*`.

**Config levels:**

- Server-level (port, CORS): `serverConfigProperties` in `apps/search-server/src/configs/types/constants.ts`
- Per-catalog (ES index, feature flags, query limits): `configOptionalProperties` in `modules/types/src/configs/constants.ts`, typed in `ConfigsObject`

**TypeScript migration:** `.js` files are not yet migrated: don't treat missing types in them as issues. Weak types in `.ts` files are worth improving when scope-adjacent.

Domain vocabulary (configuration, catalogue, facet, bucket, aggregation, filter, filter clause, SQON) is defined in `docs/concepts.md`. Read it when writing code, docs, comments, or UI strings.

**Cross-repo package migration requests, for `@overture-stack/sqon`, `-types`, `-components` specifically:** point at that package's own `README.md` and `docs/*.md` migration notes (e.g. `modules/sqon/docs/sqon-builder-absorption.md`); see `conventions/documentation.md` and `conventions/code-style.md` § Dependency version verification for why (canonical docs over a bespoke explanation, `npm view <package> dist-tags` over trusting `latest` alone).

## When to read what

Every path below is a live pointer into agentics, never a local copy to create in this project: see `conventions/convention-levels.md` § How much to keep locally for the full rule.

- Working in a specific role                    -> read `CLAUDE.roles/<role>.md` (skip if already known from global context)
- Writing or reviewing tests                     -> read `conventions/testing.md`
- Writing code                                   -> read `conventions/code-style.md`
- Reviewing a PR or change                       -> read `conventions/code-style.md`, `conventions/code-review.md`, `conventions/review-conduct.md`
- Writing or updating docs                       -> read `conventions/documentation.md`
- Security-relevant work                         -> read `conventions/security.md`, then `conventions/security-guidelines.md`; Security triggers below are Arranger-specific additions on top of that baseline
- softeng team member                            -> read `CLAUDE.softeng.md` at session start
- Overture project                                -> read `CLAUDE.overture.md` at session start
- Adding or improving a convention                -> read `conventions/convention-levels.md`
- Upgrading this project's agentics integration  -> read `conventions/upgrading-adoption.md`
- Deploying or debugging a service                -> read `.dev/docs/<service>/` if it exists

## Running tests

Always from the monorepo root:

```
npm run test -w modules/graphql-router   # single workspace
npm run test:dev                          # all dev-relevant workspaces
```

Never `cd` into a module and run `npm test` directly.

## Session discipline

Your session file is `.dev/sessions/YYYY-MM-DDTHHMMSS.md`. This repo has one human contributor working across multiple AI tools, so "per contributor per day" reduces to "per day" in practice: extend the same day's file regardless of which agent (Claude, Codex, Copilot) is writing to it. List `.dev/sessions/` for today's date prefix; extend an existing match or create a new one.

Before marking a roadmap item done or closing a tech-debt entry, verify against the actual current code or file state: not a prior description or session summary. An assumption carried forward unverified is exactly how these documents drift from what they claim.

After any meaningful unit of work, update `.dev/` and extend today's file in `.dev/sessions/`. Do not wait for a session-over signal. Do not log conversational activity. If work this session changed user-facing behaviour, flag it as `/docs` debt. Remind the developer to commit `.dev/` changes.

Full rules (rarely needed beyond the above): `conventions/session-discipline.md` in agentics.

## Security triggers

Check these as you write or review code. Flag violations rather than silently skipping them.

- **No stack traces or internal details in API responses.** GraphQL error messages sent to clients must not include stack traces, ES index names, file paths, or library versions. Log them server-side only.
- **GraphQL introspection and field suggestions off in production.** When `disablePlayground` is true or the environment is not local dev, introspection and field suggestions should be explicitly disabled.
- **Query depth and alias limits must be configured.** `GRAPHQL_MAX_DEPTH` and `GRAPHQL_MAX_ALIASES` must be set: omitting them allows DoS via deeply nested or aliased queries.
- **Validate user-provided field names before forwarding to ES.** SQON field names and any user input forwarded into ES query bodies must be validated against the known index mapping. Unvalidated field names are an injection vector.
- **No credentials or tokens in logs.** `ES_PASS`, `Authorization` header values, and bearer tokens must not appear in log output at any level, including debug.
- **HTTP remote nodes with forwarded auth headers leak credentials.** If `passthroughHeaders` includes an auth header and a remote `graphqlUrl` uses `http://` on a non-localhost host, flag it.
- **CORS wildcard is a misconfiguration outside local dev.** `allowedCorsOrigins: ['*']` must not appear in any config intended for a deployed environment.
- **`enableDebug` and `enableAdmin` must default to `false`.** Flag any code path that enables these without an explicit opt-in. Their defaults in `featureFlagDefaults` should be `false`.
- **Aggregate counts from sensitive catalogs may need suppression.** Before returning aggregation results from a catalog that may contain sensitive or re-identifiable data, check whether count suppression is configured (see roadmap).
- **`passthroughHeaders` entries must be non-empty strings.** An empty string passes current type validation but attempts to forward a header with no name: validate all entries are non-empty before use.

## Language

Canadian English throughout (catalogue, behaviour, centre, organize, analyze). Flag typos and spelling issues: don't fix silently; call them out so the developer can decide.

## Memory and contribution hygiene

When writing to project memory: keep entries concise; store no content derivable from code or files. If an insight could apply to all your projects, offer to promote it to your global context. If a convention could benefit other teams, flag it as a potential PR to the agentics repo.

## Initialization

If no project memory exists for you in this project yet, run the agentics template's initialization flow (role, softeng-team, existing-setup, `propagation_suggestions`): see [template `AGENTS.md` § Initialization](https://github.com/oicr-softeng/agentics/blob/main/template/AGENTS.md#initialization).

## Critical constraints

- No credentials, secrets, or private URLs in any file: ever
- Library/module code must not read from the environment; configuration belongs at the application boundary, passed in as typed parameters (see Conventions § Env vars for where that boundary sits in this repo)
- No commits: the user handles all git work
- Do not modify `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md` without explicit instruction: surface suggestions, do not self-edit
- No machine- or user-specific absolute paths, usernames, or individuals' real names in committed files. Use a generic placeholder for anything keyed by machine or clone location
- Name code, not people: attribute work in session files, tech-debt entries, docs, and any other persisted content to features, modules, and systems, not to individuals
