# Monorepo review, second pass: 2026-08-17

A second full-repo review, run the same day as [the first pass](monorepo-review-2026-08-17.md) but deliberately at different angles. The first pass reviewed each package's source in isolation and found source-code defects. Repeating that would have hit diminishing returns, so this pass took eight lenses that are invisible from inside any single package: cross-document link integrity, repo-level infrastructure, dependency health, cross-workspace config drift, the roadmap as an artifact, error/logging conventions systemically, the public API surface as an integrator sees it, and test strategy rather than per-file coverage.

Every finding below was verified against real code, and the highest-stakes ones were re-verified independently before being written up. Roughly 90 findings resulted; the actionable ones are filed in `tech-debt.md` and `roadmap.md`. This document holds the triage, the cross-cutting patterns, and the reference tables that don't belong in either.

## The one cluster that matters most

Seven independently-found defects converge on a single code path: **the `/download` route**. They were found by four different lenses that did not know about each other.

1. The route has zero tests at any layer. `integration-tests/server/test/spinupActive.js:137` carries `// TODO: add /download checks`, never followed up.
2. The export formatter's only tests are silently disabled. `dataToTSV.test.js:7` is `suite.skip(...)`, and because a skipped suite never registers its children, Node reports `skipped 0`. Nothing in the aggregate run indicates five tests are off.
3. `disableDownloads` is a documented, config-threaded feature flag that is never checked anywhere. The route mounts unconditionally.
4. `disableFilters` protects `/graphql` but not `/download`; the download route parses its SQON from `req.body.params`, which the access-control middleware never inspects.
5. A `date`-typed column with an unparseable value throws `ReferenceError: debug is not defined` and kills the entire export. Confirmed by execution: `'not-a-date'` and `'N/A'` both throw, `'2020-01-01'` does not. `N/A` placeholders in date fields are ordinary in clinical data.
6. The route accepts an unauthenticated `mock` flag from the client body that corrupts export pagination.
7. TSV output has no formula-injection neutralization (CWE-1236) and no delimiter/newline escaping.

Treat this as one finding about what accumulates in code nothing exercises, not as seven. Fixing (1) and (2) first is what makes the rest visible and keeps them fixed.

## If you only fix five other things

1. **`modules/charts` will break the pnpm migration.** It declares `@overture-stack/arranger-components` in `peerDependencies` only, with no dev or prod counterpart, while seven source files import it. It resolves today purely via npm's workspace-root symlink. §3.3 is currently marked "next up," so this is directly in front of the next planned work. See the depcheck note under Cross-cutting patterns.
2. **`@overture-stack/arranger-types`' types promise symbols its ESM build doesn't have.** `import { SqonBuilder } from '@overture-stack/arranger-types'` typechecks clean and is `undefined` at ESM runtime (CJS is fine, 31 keys). tsup emits the `export * from '@overture-stack/sqon'` re-export for CJS but drops it from ESM. Silent `undefined`, not a throw.
3. **42 of the repo's 45 `npm audit` criticals come from a dead 2018 Storybook install.** `modules/components` declares four `@storybook/*@3.x` packages with no storybook script, zero `*.stories.*` files, and a `.storybook/` last touched 2019-12-24. Deleting five devDependency lines takes criticals from 45 to 3.
4. **`tsconfig.eslint.json` says `"extend"` instead of `"extends"`.** Verified with `tsc --showConfig`: the base config is never loaded, so every type-aware ESLint rule across all 10 workspaces runs at `target: ES5` / `moduleResolution: node10` with `strict` off, matching how nothing in the repo is actually compiled.
5. **`modules/components`' Jest tests only ever run against `dist/`.** `modulePathIgnorePatterns: ['src', ...]` excludes every path containing "src"; `jest --listTests` returns 10 paths, all compiled output. The suite asserts against the last build, and a test added to `src/` is silently never collected.

## Cross-cutting patterns

Patterns are worth more than the individual findings that reveal them, because they predict where the next instance will be.

- **`depcheck` has at least two blind spots, and the phantom-dependency audit inherited both.** That audit (2026-08-15) recorded `modules/charts`, `apps/mcp-server`, and `modules/sqon` as clean. It missed `ts-patch` (a shell-invoked binary, not a JS import; caught later only by building a real pnpm prototype) and it missed `modules/charts`' peer-only `arranger-components` (depcheck counts a `peerDependencies` entry as declared). Two confirmed blind spots means the "clean" verdict for the remaining packages is weaker evidence than it reads as. Before the pnpm migration, re-audit by a method that doesn't share depcheck's assumptions.
- **Declared-but-unused was never checked, and that's where the production risk lives.** The phantom audit looked for imported-but-undeclared. The inverse sweep found nine unused runtime `dependencies` in published `arranger-components` and five in `arranger-graphql-router`. Three of the nine are the source of that package's high-severity production advisories. No code changes needed to remove any of them.
- **Config drift concentrates where there is no shared base.** No root `tsconfig.base.json` exists, so all 10 workspaces hand-roll their compiler settings and disagree on `strict`, `lib`, `target`, and six individual strictness flags. The same shape recurs in ESLint (`modules/charts` builds its own config and never imports the root one, so the repo-wide import-ordering convention is unenforced there) and in Prettier (two configs, two pinned versions, one plugin loaded in only one package).
- **A "fix applied where someone hit a bug, nowhere else" signature.** `{ cause }` error-chaining is applied at exactly three sites, all on the mapping-fetch path the catalogue classifier was written to serve, and dropped at five other rewrap sites. `noUncheckedIndexedAccess` is on in five packages and absent in two. The array-replacing `tsconfig` `exclude` bug already confirmed in `graphql-router` exists unfixed in `sqon` and `types` too, latent only because those packages happen to build from explicit entry points.
- **Eight error representations coexist**, with `modules/graphql-router/src/network/` alone using three at once and hand-written lossy adapters between each hop. `modules/types`, the package whose job is cross-package types, contains no error or result type at all. Two structurally incompatible `Result` implementations export identical names (`success`, `failure`, `Result`) from two packages.
- **False confidence in tests comes from what runs, not how assertions are written.** The assertion quality is genuinely high: one tautology in ~847 tests, zero mock-theatre, no snapshot rot. The problems are structural: components' Jest points at `dist/`, graphql-router runs 171 duplicate tests out of `dist/`, four network test files are 100% commented out but still counted as passing files, 12 helper modules are executed as phantom test files, and one suite is skipped invisibly.
- **Documentation of the public surface is close to absent where it matters most.** 37 of 347 public exports (10.7%) appear in any consumer-facing doc. For `modules/components`, the package with three known external integrators, it is 1 of 169.

## Corrections to earlier work, including my own

- The first pass's atlas doc noted six stale devctx entries corrected in one sitting. This pass found more, and a re-check of *this session's own edits* found one: the Changesets `ignore` list in roadmap §3.1 was audited on 2026-08-17 to add `integration-tests-mcp-server`, and that audit still missed that `integration-tests-server` is not a real package name (the package is `integration-tests-search-server`). Auditing a list is not the same as verifying every entry in it.
- A root `LICENSE` **does** exist (AGPL-3.0, tracked since 2021). An earlier claim in this session that it was absent came from a zsh glob failure aborting the whole `ls`. The real finding is narrower and sharper: the repo is AGPL-3.0 and **no** package.json declares a `license` field, so all five published packages show no license on npm. An undeclared-but-real AGPL is worse than a permissive package, because the compliance gate that should catch it never fires.
- Three times in this session a quick verification produced a false negative that made a correct agent finding look wrong: the zsh glob above, a test harness using the wrong gate property (`extendedType` instead of `displayType`) on `dateHandler`, and `grep`-ing a `.d.ts` for a symbol name that only appears via `export *`. Each held up under a proper test. Treat "my quick check contradicts a cited finding" as more likely a bad check than a bad finding.

## Reference tables

These did not exist anywhere in the repo before this pass and are useful independent of the findings.

### `npm audit` baseline (the roadmap's "Dependency vulnerability scanning in CI" item says this has never been established)

| Scope | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| Full tree (2903 deps) | 45 | 53 | 55 | 10 | 163 |
| Production only (what ships) | 0 | 15 | 5 | 2 | 22 |

Characterization matters more than the number: every critical is dev-only, 42 of 45 sit in the one dead Storybook subtree, and exactly one finding in all 163 has no fix available (`apollo-server-express`, whose CSRF advisory concerns a protection that is not enabled here in the first place). The roadmap proposes starting with a non-blocking `--audit-level=critical` report; that would read 45 on first run. Clean up, then gate.

### Testing layers

| Package | Runner | Test files | Reported cases | Real cases | Layer |
|---|---|---|---|---|---|
| `modules/sqon` | node:test | 7 | 125 | 125 | pure |
| `modules/types` | node:test | 2 | 29 | 29 | pure + 4 property-based |
| `modules/graphql-router` | node:test | 47 (+27 in `dist/`) | 407 | **236** | pure, HTTP, in-process GraphQL |
| `modules/components` | Jest | 10 in `src/` (**0 run**), 10 in `dist/` | 59 | 59 (all from build output) | pure, no DOM |
| `modules/charts` | node:test | 3 | 12 | 12 | pure |
| `apps/search-server` | node:test | 8 | 50 | 50 | pure + HTTP |
| `apps/mcp-server` | node:test | 10 | 189 | 189 | pure + module-mocked |
| `integration-tests/import` | Jest | 1 | 3 | 3 | cross-package resolution |
| `integration-tests/server` | node:test | 2 (+5 helpers) | ~88 | ~83 | real ES, HTTP |
| `integration-tests/mcp-server` | node:test | 1 (+7 helpers) | ~68 | ~61 | real ES + real MCP transport |

Layers that do not exist anywhere: DOM/rendering, contract tests between packages, generated-SDL assertions, snapshots, coverage measurement.

### Public export surface

| Package | Subpaths | Symbols | Types | Runtime | Documented | Ratio |
|---|---|---|---|---|---|---|
| `sqon` | 1 | 46 | 17 | 29 | 14 | 30% |
| `types` | 6 | 104 | 44 | 60 | 10 | 10% |
| `graphql-router` | 3 | 20 | 5 | 17 | 7 | 35% |
| `components` | **0 declared** | 169 | 116 | 53 declared / 50 real | **1** | **0.6%** |
| `charts` | 1 | 8 | 1 | 7 | 5 | 62% |

`components` declaring no `exports` map means all 441 files in its 4.6 MB tarball are deep-importable, so every internal refactor is potentially a breaking change for an import path nobody in this repo can see. Adding `exports` later is itself a breaking change, so it is cheaper before Changesets starts computing semver than after.

## Late additions from the repo-infrastructure lens

That agent died once to an infrastructure error and was rerun; its findings arrived after the rest and are folded into `tech-debt.md` alongside the others. Three are worth surfacing here because none is a source-code defect and none was previously known:

- **`make start` has been broken.** `docker-compose.yml:52` targets a build stage (`server`) that `Dockerfile.local` does not define; its three stages are `scaffolding`, `search-server`, `mcp-server`. The rename that caused this is recorded in `CHANGELOG.md:15`, which explicitly told operators to update `docker-compose.yml`; the Dockerfile and Jenkins pipeline were updated and the compose file was not. Separately the config volume mounts to `/app/modules/server/configs`, a path that no longer exists, while the server reads `/app/configs`, and compose interpolates `CONFIG_PATH` where the app and docs use `CONFIGS_PATH`. So fixing the stage name alone yields a server with zero catalogues. CI never uses compose, which is exactly why the only broken path is the one a new contributor takes first.
- **There is no security disclosure channel.** Private vulnerability reporting is disabled, no `SECURITY.md` exists here or in the org defaults, and `CONTRIBUTING.md:20` routes anyone who finds "a potential bug or issue" to a public discussion forum. For a search API in front of clinical portals, the vulnerability classes that apply are precisely the ones that must not be public before a fix ships.
- **The licensing gap is confirmed as an oversight, not a position.** Sibling Overture repos declare AGPL in their manifests; only a handful, including this one, omit it. The sharpest case: `sqon-builder` declares `AGPL-3.0-or-later` and `@overture-stack/sqon`, the package actively replacing it, declares nothing, so migrating on the project's own advice is a compliance regression.

A note on verification that cuts the other way from the calibration note above: this agent also claimed `.github` "never existed in this repo's history." That was wrong. `git ls-tree -r HEAD` shows `.github/copilot-instructions.md` tracked in `HEAD` and `git log --all -- .github` returns five commits, so the real state was a deletion of a tracked file. So the honest calibration rule is "verify either way," not "assume the agent is right."

**Resolved, and worth recording why the framing was wrong:** the deletion was the developer's, applying agentics' `copilot-instructions-retire-not-sync` decision (Copilot now reads `AGENTS.md` directly, so a second file only creates drift). It was raised here as an open governance question because the staged/unstaged split was misread as unexpected state; in this developer's workflow a populated index means "already reviewed," so staged changes are a review checkpoint rather than a signal. The genuinely useful part of the finding survives the correction: the deletion left three dangling references behind (`AGENTS.md`'s integrity check, `AGENTS.md`'s self-edit list, `DEVELOPMENT.md`'s AI-tools list), and the integrity check in particular had been passing silently on a path it could not see. All three are now cleaned up.

## Fixes applied 2026-08-17

Eight fixes were applied after the review, each chosen for being unambiguously correct and verifiable immediately, and each verified rather than assumed. The `tech-debt.md` entries carry per-item notes.

| Fix | Verification |
|---|---|
| `dataToExportFormat.js` `ReferenceError` on unparseable dates | rebuilt; `'not-a-date'` and `'N/A'` now emit unchanged instead of throwing |
| `docker-compose.yml`: `target: server` to `search-server`, mount to `/app/configs`, `CONFIG_PATH` to `CONFIGS_PATH` | `docker compose config` validates; stage name matches `Dockerfile.local` |
| `tsconfig.eslint.json`: `"extend"` to `"extends"` | `tsc --showConfig` now shows `strict`, `target: es2022`, `module: nodenext` inherited |
| `modules/charts` `main`: `.dist/` to `./dist/` | resolved path now exists on disk |
| `modules/components`: removed phantom `AggsWrapper` export | rebuilt; absent from `dist/index.js` and `dist/index.d.ts` |
| `modules/types`: added missing `imports` field | alias resolves under `tsx`; 29 tests pass, `sqon`'s 125 unaffected |
| `CHANGELOG.md`: broken migration-guide path, wrong package name | paths and name checked against the real files |
| `.gitignore`: added `.claude/` entries | previously excluded only by a machine-local rule |

Deliberately **not** fixed, with reasons: the license fields need the client-side AGPL question answered first; the `modules/charts` peer-dependency fix and the Storybook 3 removal both require a lockfile regeneration rather than a manifest edit; the test-configuration fixes (components' Jest pointing at `dist/`, graphql-router's duplicate compiled tests, the skipped suite) would surface previously-unrun tests, which is real work rather than a fix; and the `.github/copilot-instructions.md` deletion is a governance decision for the developer.

**One new finding came out of verifying a fix rather than out of the review itself:** `dateHandler` renders dates a day early on negative UTC offsets, because `new Date('2020-01-01')` parses as UTC midnight while `date-fns` formats in local time. Confirmed by execution (`'2020-01-01'` emits `2019-12-31`). Every date in every export is shifted for North American deployments. Logged separately rather than fixed, because choosing between local-parsing and UTC-formatting is a semantics decision. Worth noting as a pattern: verifying a fix by actually running the code surfaced a second, quieter bug in the same function that reading it had not.

## Scope of this pass

Not covered: `jenkins-pipeline-library` (separate repo, outside the approved working directories; two Docker/CI findings could not be verified against real Jenkins behaviour as a result), load and performance testing, anything needing a running cluster beyond what could be reasoned from source and fixtures, and the Overture platform-level ABAC work. Nothing was fixed; this was scoped as review and documentation.
