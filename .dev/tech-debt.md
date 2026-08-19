# Arranger: Technical Debt

Issues logged here when found scope-adjacent to other work. Not a priority backlog; no obligation to fix in order.
`standalone: yes` entries can be picked up freely without broader context.

---

## modules/sqon

### Relocate remaining `__tests__/` test files to co-located positions

standalone: yes
context: `modules/sqon/src/__tests__/jsonSchema.test.ts` and `schema.test.ts` are the remaining files in a `__tests__/` directory after `operators.test.ts` was moved to `src/operators/index.test.ts`. Move `jsonSchema.test.ts` alongside its source and `schema.test.ts` alongside `src/schema/index.ts` (or equivalent source file) to follow the co-location convention. The `__tests__/` directory can then be removed.

### Remove the "no stable release yet" warning once 1.0.0 ships

standalone: yes
context: `modules/sqon/README.md` carries a "No stable release yet" section (marked with a removal TODO comment) and `package.json`'s `description` field has a "(see README...)" suffix, both added while `latest` still pointed at a pre-builder-absorption release. Once a real, non-RC `1.0.0` is published under `latest`, remove the README section and revert the description to its original text.

### No combined field-type-to-operator-validity endpoint

**File:** `modules/sqon/src/operators/index.ts` (`getSqonFieldOperatorDetails()`); `modules/graphql-router` (`extended` config query)
**Severity:** medium (blocks clean validation in MCP / evaluation harness)
**Kind:** missing feature / integration gap
**Issue:** The operator applicability rules exist (`getSqonFieldOperatorDetails()` in `modules/sqon`) and the field type information is available (via the `extended` GraphQL query, which returns ES types from `flattenMappingToFields()`). But these two sources are not connected in any Arranger-native API. A caller who wants to validate whether a given operator is legal for a given field must join both sources themselves. This is a gap surfaced by the LLM evaluation harness (Field & Operator Validity metric) and equally relevant to the MCP server, which should reject invalid operator/field-type combinations before forwarding to Elasticsearch.
**Fix:** Add a query or utility (either a new GraphQL field on the config endpoint or a standalone function in `modules/sqon`) that, given an Arranger index, returns each field name with its ES type and the set of valid SQON operators for that type. `getSqonFieldOperatorDetails()` already encodes the rules; it just needs to be composed with the field list.
**Standalone:** yes; additive, no changes to existing query behaviour

### `getValidFieldOperators` in graphql-router and `getSqonFieldOperatorDetails` in modules/sqon are divergent implementations of the same rules

**File:** `modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts` (`getValidFieldOperators()`); `modules/sqon/src/operators/index.ts` (`getSqonFieldOperatorDetails()`)
**Severity:** low (currently consistent in practice, but will drift)
**Kind:** duplication / maintenance risk
**Issue:** Two separate implementations encode which SQON operators are valid for which field types. `buildCatalogueIntrospection.ts` has a more nuanced classification (ENUM_LIKE_TYPES, RANGE_TYPES, fallback) while `modules/sqon` returns a flat list with `applicableTo: 'all'` for non-range operators. They're consistent today but maintained independently; any future operator addition requires updating both. They have also drifted in naming: after the `filter` → `wildcard` rename, `getValidFieldOperators` still advertises the legacy `filter` name in introspection responses. The MCP Server's `queryValidation.ts` shims this by normalizing introspected operator names through `normalizeSqonOp` before comparison (2026-07-07).
**Fix:** Consolidate into `modules/sqon` as the single source of truth. Extend `getSqonFieldOperatorDetails()` to carry the same field-type classification detail that `buildCatalogueIntrospection.ts` currently encodes locally. `buildCatalogueIntrospection.ts` then becomes a thin projection over the module's data. Switch introspection operator lists to canonical names in the same pass (client-visible change). See [roadmap: consolidate field-type-to-operator rules](roadmap.md#consolidate-field-type-to-operator-rules-into-modulessqon).
**Standalone:** yes; internal refactor; the canonical-name switch changes API output and needs a coordinated note for introspection consumers

### Published SQON JSON Schema contains dangling `$ref` pointers after `anyOf` → `oneOf` normalization

**File:** `modules/sqon/src/jsonSchema/runtime.ts` (`normalizeUnionKeywords`)
**Severity:** medium (published schema is not resolvable by strict JSON Schema tooling; confuses LLM consumers of `get_sqon_schema`)
**Kind:** bug
**Issue:** `zodToJsonSchema` deduplicates the shared value schema by emitting `$ref` pointers like `#/$defs/All/properties/content/properties/value/anyOf/0` (used by `Between`, `InLike`, `RangeLike`, and inside `All` itself). `normalizeUnionKeywords` then renames every `anyOf` key to `oneOf`, but does not rewrite the `$ref` _path strings_, which still point at `.../anyOf/0`. Those JSON Pointers no longer resolve: the published schema is technically invalid. Permissive consumers won't notice; strict resolvers will fail, and LLMs reading the schema see references into paths that do not exist.
**Fix:** Either rewrite `$ref` strings during normalization (string-replace `/anyOf/` → `/oneOf/` in `$ref` values), or avoid the problem entirely by inlining the scalar/array value schema instead of cross-def `$ref` chains (better for LLM readability anyway; see the LLM SQON-generation analysis, 2026-06-11 session). Add a test that resolves every `$ref` in the emitted schema.
**Standalone:** yes; self-contained fix in `runtime.ts` plus a resolution test

### `SqonBuilder.not([...])` inverts AND/OR semantics when merging same-field exclusion filters

**File:** `modules/sqon/src/builder/reduce.ts:28,49` (`MERGE_VALUES_UNDER_AND_OPS`, `shouldReduceOp`)
**Severity:** high
**Kind:** bug (correctness)
**Issue:** `shouldReduceOp` treats `and` and `not` identically (`combinationOp === 'and' || combinationOp === 'not'`) when deciding whether to merge same-field `not-in`/`some-not-in`/`all` filters into one. That's wrong under `not`: `{op:'not', content:[notIn(A), notIn(B)]}` means "excludes A AND excludes B" (double negation over an implicit AND), but merging the two children first produces `{op:'not', content:[notIn([A,B])]}`, which means "excludes A OR excludes B", a strictly broader, different result set. Confirmed directly against the built package: `SqonBuilder.not([SqonBuilder.notIn('tags',['A']).toValue(), SqonBuilder.notIn('tags',['B']).toValue()]).toValue()` returns `{"op":"not","content":[{"op":"not-in","content":{"fieldName":"tags","value":["A","B"]}}]}`, the merged (wrong) form. Verified algebraically that `all` has the same defect and `in` under `not` does not (the two are equivalent either way). Reachable through the public, documented `SqonBuilder.not(content)` API, not an internal-only path. The one existing test touching `.not([...])` with multiple items (`builder/index.test.ts:261-267`) uses `in` (the one case that happens to be correct) and only asserts `result.op === 'not'`, never checking `content`.
**Fix:** Remove `'not'` from `shouldReduceOp`'s condition for `MERGE_VALUES_UNDER_AND_OPS`, so `not-in`/`some-not-in`/`all` only merge under `and` (matching how `or` already correctly keeps them separate). Add a test exercising `not-in`/`some-not-in`/`all` inside `.not([...])`, asserting on `content`, not just `op`.
**Standalone:** yes; a small, isolated logic fix plus a regression test.

### `SqonSchema` has no recursion-depth limit; a ~25KB nested payload throws an uncaught `RangeError` out of `safeParse()`

**File:** `modules/sqon/src/schema/index.ts:86-96` (`SqonCombinationSchema`, `SqonSchema`, both `zod.lazy` with no depth cap)
**Severity:** high
**Kind:** security
**Issue:** The schema's recursive combination type has no nesting-depth limit. A SQON nested roughly 1000 levels deep (~25KB of JSON) throws `RangeError: Maximum call stack size exceeded` directly out of `SqonSchema.safeParse()`, confirmed by direct execution against the built package (depth 100 parses in 5ms; depth 1000 throws). This defeats zod's own `safeParse` contract, which is documented to never throw, callers are meant to check `.success` instead of wrapping in try/catch. Because a SQON travels as a GraphQL *variable*, not inside the query document text, it is invisible to `graphql-router`'s existing `maxDepthRule`/`maxAliasesRule` AST-depth protections; those don't apply here. Confirmed reachable with no surrounding try/catch: `apps/mcp-server/src/arranger/queryValidation.ts:84` and `apps/mcp-server/src/mcp/buildSqonTool.ts:329` both call `SqonSchema.safeParse(rawSqon)` directly on externally-supplied content, on the explicit assumption it can't throw. A cheap, uncaught-exception-shaped resource-consumption vector against an MCP endpoint that (per existing entries above) has no authentication or rate limiting either.
**Fix:** Add an explicit max-depth check before or during parsing (a `zod.lazy` guard that tracks recursion depth and fails cleanly past a configurable limit, or a cheap pre-check walking the raw object once), so oversized nesting becomes a normal `{success:false}` validation failure instead of an engine-level exception.
**Standalone:** yes.

### Merging range filters (`gt`/`gte`/`lt`/`lte`) with date-string values silently produces `null` instead of a comparison

**File:** `modules/sqon/src/builder/reduce.ts:66-75` (`mergeIntoExisting`)
**Severity:** high
**Kind:** bug (correctness)
**Issue:** When two range filters on the same field are merged under `and`/`or`, the code does `Math.max(a, b)`/`Math.min(a, b)` after an `as number` cast, with no runtime check that the values are actually numeric. `gt`/`gte`/`lt`/`lte` explicitly support `'date'` fields (`operators/constants.ts:93`, `RANGE_APPLICABLE_TYPES`) and `SqonScalarValueSchema` permits string values for these ops, the ordinary shape for an ISO date filter. `Math.max`/`Math.min` on a date string coerces via `Number(...)`, which is `NaN` for a non-numeric string, and `NaN` serializes to `null`. Confirmed directly: merging `gt('donor.date_of_diagnosis','2020-01-01')` with `gt('donor.date_of_diagnosis','2021-06-15')` under `.and()` produces `{"op":"gt","content":{"fieldName":"donor.date_of_diagnosis","value":null}}`, silently corrupting an ordinary date-range-narrowing operation into a `null`-valued filter. `builder/index.test.ts`'s `reduceSqon` suite (lines 368-398) only exercises numeric values for these four ops; no test uses a date-typed (string) value.
**Fix:** In `mergeIntoExisting`, detect non-numeric scalar values and compare via string ordering (correct for ISO 8601 dates) or `Date.parse`, falling back to numeric comparison only when both values are genuinely numbers. Add a date-value test case to the existing `reduceSqon` suite.
**Standalone:** yes.

### `removeFilter` can leave a schema-invalid or semantically-empty filter instead of removing it, contradicting its own documented contract

**File:** `modules/sqon/src/builder/index.ts:210-217` (`stripValues`), consumed at lines 225-226 and 244-250
**Severity:** medium
**Kind:** bug
**Issue:** `removeFilter`'s own doc comment (lines 106-108) states it "removes the filter entirely if no values remain." `stripValues` filters the value array but only detects "remove the whole filter" on an *exact* full-set match (via `matchesArgs`); it never checks whether the filtered result is simply empty. Passing a superset of the filter's actual values, a realistic case (e.g. removing several known values, not all of which are present) leaves the filter in place with `value: []` instead of removing it. Confirmed: `SqonBuilder.from(SqonBuilder.all('tags',['a','b']).toValue()).removeFilter('tags','all',['a','b','c']).toValue()` returns `{"op":"all","content":{"fieldName":"tags","value":[]}}`, and `SqonSchema.safeParse(...)` on that result returns `success: false` (`AllFilterSchema`'s `value` requires `.min(1)`), i.e. the package's own schema rejects its own builder's output. For `in`/`not-in`/`some-not-in` the schema doesn't reject an empty array, but an empty-value filter is a landmine for whatever downstream query builder consumes it. No existing test in `removeFilter()`'s suite (`index.test.ts:461-491`) passes a superset value list.
**Fix:** In `stripValues`, treat an empty filtered result as "remove this node entirely" and wire that signal through both call sites (the standalone-field branch and the group-content `.map()` branch) instead of returning an empty-valued node. Add a superset-removal regression test.
**Standalone:** yes.

### `checkMatchingArrays`'s sort comparator is not a valid total order; breaks set-equality for mixed-type values

**File:** `modules/sqon/src/builder/utils.ts:35-40`
**Severity:** medium
**Kind:** bug
**Issue:** The comparator `(x, y) => (String(x) < String(y) ? -1 : 1)` never returns `0`, so it isn't a valid comparator whenever two distinct values stringify identically (e.g. the number `1` and the string `'1'`, both legal in the same value array per `SqonScalarOrArrayValueSchema`). This breaks `.sort()`'s ordering guarantee, so two arrays holding the exact same multiset in a different order can sort into different sequences, and the function returns `false` for arrays that should compare equal. Confirmed by exhaustive permutation testing of `[1, '1', 2]`: most reorderings compare as non-matching despite being the same multiset. This backs `checkMatchingFilter` (used by `removeExactFilter`) and `removeFilter`'s exact-match detection. `builder/utils.ts` has zero dedicated test coverage despite being a public export from the package root.
**Fix:** Use a comparator that returns `0` for equal keys (e.g. compare stringified keys with `===`/`<` rather than always branching to `-1`/`1`), or sort by a stable, collision-free key. Add a dedicated test file for `builder/utils.ts` covering mixed-type arrays.
**Standalone:** yes.

---

## build tooling

### Migrate from npm to pnpm

standalone: yes
context: npm's flat hoisting causes esbuild binary version conflicts across workspaces when multiple packages use tsup. Adding sqon as a second tsup consumer caused bundle-require's peer esbuild to be hoisted to root at a mismatched version. pnpm's strict per-package isolation would prevent this class of issue; each package sees only what it declares. Migration requires updating the Jenkins pipeline and any Dockerfiles that invoke npm.

### Upgrade tsup from 6.7.0 to 8.5.1

standalone: no
context: tsup@6.7.0 is ~2 years old. Upgrading to 8.5.1 is blocked by the npm hoisting problem above: tsup@8.5.1 brings esbuild@^0.27.0, which conflicts with tsx's esbuild@~0.28.0 and bundle-require's peer dep resolution under npm. Revisit after pnpm migration.

### `apps/search-server`, `apps/mcp-server` and `integration-tests/server` don't rebuild `file:`-referenced workspace packages before testing

standalone: yes
context: `apps/search-server` depends on `modules/graphql-router` via `"file:../../modules/graphql-router"`, resolved through that package's `dist/` (its `package.json`'s `main`), never live source. `apps/mcp-server` has the same exposure through `"@overture-stack/sqon": "file:../../modules/sqon"` (added to this entry 2026-08-10): its own source runs from `src/` under `tsx`, but every `SqonBuilder`, `addFilterClause`, `SqonSchema`, and `getSqonFieldOperatorDetails` call resolves to `modules/sqon/dist`, and `build_sqon` depends on all four for the operator set it advertises, the fold, validation, and root normalization. A stale `dist/` there means its unit tests pass against SQON semantics the module no longer has, with no warning; the same holds for `integration-tests/mcp-server`, which imports the app from source. Running `search-server`'s or `integration-tests/server`'s tests without first running `npm run build -w modules/graphql-router` silently tests against whatever `dist/` was last built, no warning that it's stale. Concretely hit during the multicatalogue partial-availability work (2026-07-24): the `{ cause: err }` fix in `fetchMapping.ts`/`router.ts` passed every unit test (which import from source via internal path aliases, never crossing the package boundary) but silently produced `unknown_error` instead of `index_not_found` when exercised through a real integration test, because `dist/` was 8 days stale at that point. Only caught because a real end-to-end integration test against live Elasticsearch was written and run (see `integration-tests/server/test/partialAvailability.test.ts`); a unit test alone could not have caught this, by construction.
fix: add a `pretest` step to `apps/search-server`, `apps/mcp-server`, `integration-tests/server` and `integration-tests/mcp-server` that rebuilds their local `file:` dependencies first, or wire `turbo:test`'s dependency graph to do this automatically (Turbo already tracks the monorepo's build graph); at minimum, document prominently in `AGENTS.md`'s "Running tests" section that changes to `modules/*` require an explicit rebuild before testing any consumer app, the current guidance to "always run from the monorepo root" doesn't by itself guarantee a fresh build.

### No OpenSearch service in `docker-compose.yml`

standalone: yes
context: `docker-compose.yml` defines only `elasticsearch`, `kibana`, `server` and `ui`, so there is no way to bring up a local OpenSearch cluster. The Makefile carried a `start-os` target that did `up -d opensearch` against this file; since no such service exists it could never have worked, and it was removed 2026-07-30 while correcting the sibling `start-server` target (which referenced `arranger-server`, the _container name_ of `server`, rather than the service key). Arranger supports OpenSearch 1.x+ and `SEARCH_ENGINE=opensearch` is a documented `apps/search-server` env var, so local OpenSearch cannot currently be exercised the way Elasticsearch can. Fix: add an `opensearch` service (plus optional OpenSearch Dashboards) to `docker-compose.yml` and restore a `start-os` target. Note the Makefile's existing `COMPOSE_PROJECT_NAME=arranger_es` / `arranger_os` split implies the two engines are meant to be alternatives sharing port 9200, so they should not be started together under the same project name.

### Root `test:watch` script silently no-ops for `integration-tests/import`

standalone: yes
context: `"test:watch": "concurrently --group \"npm:modules:watch\" --group \"npm:test:watch -w modules/components -w integration-tests/import\""`. Confirmed by running the resulting command directly: `integration-tests/import/package.json` has no `test:watch` script (only `modules/components` does), and npm's multi-`-w` form silently skips a workspace lacking the requested script, no warning, no error, exit 0, while it does start `modules/components`'s Jest watch mode. This root script has quietly never run `integration-tests/import`'s tests in watch mode, with no signal that half the command does nothing.
fix: either add a `test:watch` script to `integration-tests/import/package.json` (e.g. `jest --config=jest.config.ts --watch`), or drop `-w integration-tests/import` from the command if it was never meant to run there.

### `fix-workspace-deps.mjs` gives no signal when it finds nothing to rewrite

standalone: yes
context: when the target package's dependency blocks contain no `file:`-prefixed spec, the script exits `0` with zero console output, identical, from the pipeline's point of view, to "found and fixed one `file:` dep." The existing "`file:` local dependencies in publishable packages" entry below already logs an unexplained incident where `@overture-stack/arranger-types` was published still carrying a raw `file:../sqon` reference, speculating "a step in the publish loop silently didn't apply it that run." This script is a direct, concrete mechanism that would produce exactly that symptom: a wrong `packagePath` argument, an already-rewritten file re-run a second time, or a package resolved from the wrong CWD would all silently no-op with no distinguishing log line. Could not confirm from this review alone whether this is what actually caused that specific incident, only that the mechanism exists.
fix: always log a summary (`${packagePath}: N file: dep(s) rewritten`, even when N is 0), and/or exit non-zero if any `file:`/`workspace:` spec remains in the file after running, so the pipeline log can distinguish "correctly nothing to do" from "silently missed something."

### Dockerfiles bake an insecure-looking default ES password into build ARGs, and disagree with `docker-compose.yml`'s placeholder

standalone: no; verify what the Jenkins pipeline actually overrides before changing behaviour
context: both `docker/Dockerfile.jenkins:8` and `docker/Dockerfile.local:8` declare `ARG ES_PASS=unsafePassword123`, which flows to `ENV ES_PASS=$ES_PASS` in the `search-server` stage. A build invoked without an explicit `--build-arg ES_PASS=...` override ships with a real-looking default credential baked in as its `ENV` default, visible via `docker inspect`/`docker history`. `docker-compose.yml:58` uses a *different* placeholder (`"${ES_PASS:-badpassword}"`) for the same variable, so there isn't even one agreed "obviously fake" placeholder across the repo. Could not verify from this repo alone whether the Jenkins pipeline (outside this repo's own working directories) always overrides this ARG in practice.
fix: drop the default value from the `ARG` declarations (or use an obviously-invalid sentinel like `CHANGE_ME`) so a build without an explicit override fails fast rather than silently succeeding with a real-looking password; standardize on one placeholder string across `docker-compose.yml` and both Dockerfiles.

### `Dockerfile.jenkins`/`Dockerfile.local` copy the whole build context before `npm ci`, defeating layer caching

standalone: yes
context: the `scaffolding` stage does `COPY . .` immediately followed by `RUN npm ci ...`, with no earlier `COPY package*.json` step, in both Dockerfiles. Docker's layer cache keys off the `COPY . .` layer's content hash, so any change anywhere in the non-ignored build context, a source file edit, a script tweak, a README change, invalidates that layer and forces a full `npm ci` re-run on every build, even when no manifest changed.
fix: split into `COPY package.json package-lock.json ./` (plus each workspace's `package.json`) → `RUN npm ci` → `COPY . .`, so dependency installation is only invalidated by actual manifest changes.

### `.gitignore` ignores the root lockfile, which is actually tracked and actively maintained

standalone: yes
context: `.gitignore:12` has `**/package-lock.json`, but `git ls-files` shows the root `package-lock.json` is tracked and was modified as recently as the phantom-dependency-fix commit. `.gitignore` doesn't retroactively untrack an already-tracked file, so today this rule is inert, not actively harmful, but it's a live footgun: a future gitignore cleanup pass (`git rm -r --cached . && git add -A`-style) would silently drop the lockfile from version control, since the rule already declares that path unwanted.
fix: either remove the blanket `**/package-lock.json` rule (there's only ever one lockfile in this npm-workspaces layout, and it's meant to be committed), or scope it precisely to guard against accidental nested lockfiles without shadowing the root one.

### `scripts/remap-catalogue-fields.mjs` is a real, destructive-in-place tool with no documentation or safety rails

standalone: yes
context: this script rewrites `extended.json`, `facets.json`, and `table.json` in place via `writeFileSync`, with no dry-run mode, no diff/preview output beyond a per-file count, and no backup. It isn't wired into any npm script, and isn't referenced in `DEVELOPMENT.md`, `README.md`, or `CONTRIBUTING.md` (grepped, zero hits outside the file's own usage string), despite its own header comment explicitly cross-referencing the `nestingPrefix` feature. A config maintainer has no way to discover this tool exists short of reading `scripts/` directly.
fix: document it (a line in `DEVELOPMENT.md` or a config-maintenance doc under `.dev/docs/`), and add a `--dry-run` flag that prints the diff without writing, given it mutates real catalogue config files with no undo.

### `modules:tag` uses a no-op npm flag slated for removal, and versions every workspace despite its name

standalone: yes
context: `"modules:tag": "npm version --ws --force-publish --yes"`. Reproduced directly against the repo's resolved npm (11.5.1): running this pattern emits `npm warn Unknown cli config "--force-publish". This will stop working in the next major version of npm.` `--force-publish` is a Lerna convention, not a real npm CLI option; npm currently tolerates it as an unrecognized config but that tolerance is slated for removal, at which point this script starts failing outright. Separately: `--ws` with no `--workspace` filter targets all 10 declared workspaces, not just `modules/*` as the script name implies, reproduced empirically. Harmless today (apps/integration-tests packages are private and nothing reads their `version` field), but a real mismatch between the script's name/intent and what it actually touches.
fix: drop `--force-publish` (it does nothing under npm's own `version` command). If per-workspace scoping was intended, use explicit `--workspace modules/x` flags instead of bare `--ws`.

### `dotenv` version floor disagrees between two packages fixed in the same recent pass, for what was described as an identical gap

standalone: yes
context: `integration-tests/server/package.json` declares `"dotenv": "^16.0.3"` (2022-09-29) while `integration-tests/mcp-server/package.json` declares `"dotenv": "^16.6.1"` (2025-06-27). Both declarations were added in the same phantom-dependency fix pass, for what that work's own record calls "the same shared test template" gap in both packages, yet ended up with different, and both notably behind-current, version floors. Currently masked by npm hoisting (both resolve to the same installed version via the lockfile), so there's no live breakage, but the source-of-truth ranges disagree for an identical stated need.
fix: align both to the same range, verifying current `dotenv` major compatibility first, per this repo's own dependency-verification convention.

### `tsconfig.eslint.json` says `"extend"` instead of `"extends"`, so repo-wide type-aware linting runs against a config nothing is compiled with

**File:** `tsconfig.eslint.json:12`; consumed by `eslint.config.js:34` (`project: ['./tsconfig.eslint.json']`)
**Severity:** high
**Kind:** bug (config typo with repo-wide effect)
**Issue:** The key is `"extend"`, not `"extends"`. TypeScript ignores unknown top-level keys silently, so `@tsconfig/node22/tsconfig.json` is never loaded. Confirmed directly with `npx tsc --showConfig -p tsconfig.eslint.json`: the resolved config contains only the five explicitly-set options (`allowJs`, `erasableSyntaxOnly`, `forceConsistentCasingInFileNames`, `strictNullChecks`, `verbatimModuleSyntax`) plus two defaults. Absent: `strict`, `target`, `module`, `moduleResolution`, `lib`, `esModuleInterop`, `skipLibCheck`. This is the single TypeScript program every type-aware ESLint rule runs against for all 10 workspaces, so linting currently evaluates the whole repo at `target: ES5` / `module: commonjs` / `moduleResolution: node10` with `strict` off, which matches how no package is actually built. Any rule reasoning about nullability beyond `strictNullChecks`, or about module resolution, produces different results than the real builds would.
**Fix:** Rename the key to `"extends"`. Expect a burst of genuine new diagnostics on the first run afterwards; that is the point. Note `turbo.json:4` lists this file in `globalDependencies`, so cache behaviour changes too (see the `turbo.json` entry in `## monorepo: cross-cutting`).
**Standalone:** yes for the rename; the diagnostics it surfaces are their own follow-up.
**FIXED 2026-08-17.** Key corrected; verified with `tsc --showConfig` that the base now applies (`strict=True`, `target=es2022`, `module=nodenext`). Expect real lint diagnostics on the first run, and note the separate `**/*.json` include problem below still makes `eslint .` impractically slow.

### A dead 2018 Storybook install in `modules/components` is the source of 42 of the repo's 45 `npm audit` criticals

**File:** `modules/components/package.json:84-86,96,106`; `modules/components/.storybook/`
**Severity:** high
**Kind:** vulnerability / dead-code
**Issue:** `modules/components` declares `@storybook/react: ^3.3.3`, `@storybook/addon-actions: ^3.3.8`, `@storybook/addon-options: ^3.3.11`, and `storybook-router: ^0.3.3`, resolving to Storybook 3.4.12 (a 2018 release carrying webpack 3, Babel 6, and `react-dev-utils@5`). That subtree alone supplies 42 criticals (`babel-traverse` arbitrary code execution, `loader-utils` prototype pollution, `react-dev-utils` OS command injection, `shell-quote`, `sockjs-client`/`eventsource`, `websocket-driver`, plus 34 Babel 6 packages) and 23 of the 53 highs. It is entirely dead, confirmed three ways: no `storybook` script in the package (unlike `modules/charts`, which runs Storybook 9), zero `*.stories.*` files anywhere under the package, and `.storybook/` last modified 2019-12-24. `@storybook/addon-options` shows `maintainers: 0` on the registry. `babel-polyfill` (also declared) exists solely for `.storybook/config.js:1` and drags in the npm-deprecated `core-js@2`.
**Fix:** Delete the four `@storybook/*`/`storybook-router` devDependencies plus `babel-polyfill`, and delete `modules/components/.storybook/`. Five lines and a directory; takes criticals from 45 to 3. If Storybook is wanted here, adopt `modules/charts`' existing Storybook 9 setup as new work rather than upgrading a 2018 install in place. See also [roadmap: Storybook (or similar)](roadmap.md#storybook-or-similar-for-modulescomponentsmodulescharts-carrying-their-own-integration-tests), whose framing assumes no Storybook exists in either package.
**Standalone:** yes.

### `make start` is broken: `docker-compose.yml` targets a build stage that does not exist, and mounts configs where nothing reads them

**File:** `docker-compose.yml:52` (`target: server`), `:64` (the config volume); `docker/Dockerfile.local:13,27,83`; `apps/search-server/src/configs/fromEnv/localEnvs.ts:33`
**Severity:** high (the first thing a new contributor runs, and the only broken path is the one CI never takes)
**Kind:** stale config
**Issue:** Two independent defects on the same service, both confirmed directly.

1. **No such build stage.** `docker-compose.yml:52` specifies `target: server`. `Dockerfile.local` defines exactly three stages: `scaffolding` (:13), `search-server` (:27), `mcp-server` (:83). `docker compose build server` therefore fails outright, which breaks `make start` and `make start-server`, both documented as working in `DEVELOPMENT.md:50`. `CHANGELOG.md:15` records the cause: the image rename from `arranger-server` to `arranger-search-server` told operators to update `docker-compose.yml`, the Dockerfile and the Jenkins pipeline were both updated (the pipeline builds `--target search-server`), and the compose file, the one place the changelog explicitly named, was missed.
2. **Config mount goes nowhere, and the variable name disagrees.** The mount is `"${CONFIG_PATH:-./docker/server}:/app/modules/server/configs"`. `modules/server` no longer exists (the `search-server` stage copies `apps/search-server` plus three `dist/` directories into `/app`), and the server resolves configs from `process.env.CONFIGS_PATH || './configs'` relative to `WORKDIR /app`, so it reads `/app/configs`. The service sets no `CONFIGS_PATH`. Compose also interpolates `CONFIG_PATH` (singular) while the app and `docs/setup.md:121` both use `CONFIGS_PATH` (plural), so even setting the documented variable has no effect on the mount. Fixing (1) alone yields a server with zero catalogues.

CI is unaffected because the pipeline never uses compose, which is precisely why this went unnoticed.
**Fix:** Change `target: server` to `target: search-server`; change the mount destination to `/app/configs`; rename `CONFIG_PATH` to `CONFIGS_PATH`. Verify with `make start` followed by `curl localhost:5050/introspection` returning a non-empty catalogue list. Consider adding an `mcp-server` service while there, since both the app and its Dockerfile stage exist but compose cannot run it.
**Standalone:** yes.
**FIXED 2026-08-17.** `target: server` corrected to `search-server`; the config volume now mounts to `/app/configs` and interpolates `CONFIGS_PATH` to match the app and `docs/setup.md`. `docker compose config` validates. A full `make start` round trip against a live cluster is still worth doing before considering this closed.

### No security disclosure channel exists, and the documented path is a public forum

**File:** absent: `SECURITY.md` (in this repo and in `overture-stack/.github`); `CONTRIBUTING.md:20`
**Severity:** high
**Kind:** missing governance
**Issue:** GitHub's private vulnerability reporting is disabled for this repo and there is no `SECURITY.md` to fall back on, in this repo or in the org-wide defaults. The org `.github` repo does have `ISSUE_TEMPLATE/security.md`, but reading it, it is a *dependency upgrade request* template, not a disclosure policy, and filing it opens a public issue. Meanwhile `CONTRIBUTING.md:20` instructs anyone who finds "a potential bug or issue" to "first post it to our GitHub support discussion forum", which is public. So the only written instruction routes a security report into public view. This matters concretely for this project rather than generically: Arranger is the search API in front of clinical and research portals, and the vulnerability classes that actually apply here (a field-name injection reaching ES, an auth-header passthrough leak, an aggregation count exposing re-identifiable data, all of which `AGENTS.md` already names as real risk surfaces) are exactly the ones that must not be public before a fix reaches OHCRN and iMicroSeq.
**Fix:** Enable GitHub private vulnerability reporting (a repo setting, no code change) and add a `SECURITY.md` with a private contact and a disclosure window. Add a carve-out sentence to `CONTRIBUTING.md:20` routing security issues away from Discussions. Since every Overture service shares this gap, the durable fix is a `SECURITY.md` in `overture-stack/.github` that all repos inherit; this repo's own file can then be a pointer.
**Standalone:** yes.

### `.claude/` is excluded only by a machine-local ignore rule, not by the repo

**File:** `.gitignore` (no `.claude` entry); `.claude/settings.local.json` present and untracked
**Severity:** medium
**Kind:** security hygiene
**Issue:** `git check-ignore -v .claude/settings.local.json` resolves the rule to the developer's *personal global* gitignore, and `.claude/worktrees/` is excluded by `.git/info/exclude`. Neither travels with a clone. Any other contributor, the same developer on another machine, or a fresh clone gets no exclusion for `.claude/` at all, so a `git add -A` sweeps local Claude settings into the repo. `settings.local.json` is exactly the file that accumulates local permission grants and machine-specific paths, which `AGENTS.md:144` explicitly forbids in committed files. Note the related inaccuracy: `AGENTS.md:31` states "only a gitignored `settings.local.json`", which reads as though the repo does the ignoring. It does not.
**Fix:** Add `.claude/settings.local.json` and `.claude/worktrees/` to the repo `.gitignore` (or `.claude/` with a `!` carve-out if a shared `.claude/settings.json` is ever wanted). One line, and it makes the `AGENTS.md` statement true.
**Standalone:** yes.
**FIXED 2026-08-17.** Added `.claude/settings.local.json` and `.claude/worktrees/` to the repo `.gitignore`, which also makes `AGENTS.md:31`'s claim about it accurate.

### `npm audit` baseline, established 2026-08-17

**Severity:** informational (the baseline itself); the actionable items are the two entries above and the unused-dependency entries per package
**Kind:** reference
**Issue:** [roadmap: Dependency vulnerability scanning in CI](roadmap.md#dependency-vulnerability-scanning-in-ci) says the recommended starting point is a non-blocking `npm audit --audit-level=critical` to "understand the current baseline before committing to a failure policy." That baseline had never been run. Measured:

| Scope | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| Full tree (2903 deps) | 45 | 53 | 55 | 10 | 163 |
| Production only (`--omit=dev`) | 0 | 15 | 5 | 2 | 22 |

Every critical is dev-only. 42 of 45 are the Storybook 3 subtree above. Exactly one finding in all 163 has no fix available: `apollo-server-express`, whose moderate CSRF advisory (GHSA-9q82-xgwf-vj6h) concerns a `csrfPrevention` protection that is never enabled anywhere in this repo to begin with, so the bypass it describes is moot and the real gap is that the protection is off.
**Fix:** Sequence the roadmap item as cleanup-then-gate rather than gate-first: remove the Storybook subtree and the unused runtime dependencies, re-run both audits to record a real baseline, then wire the non-blocking report in. Separately, set `csrfPrevention: true` on both `ApolloServer` constructions in `graphqlRoutes.ts` (Apollo Server 4's default; costs nothing and is independent of the migration).
**Standalone:** yes.

## apps/mcp-server

### `InMemoryEventStore` is not suitable for production

**File:** `apps/mcp-server/src/utils/inMemoryEventStore.ts`
**Severity:** medium (data reliability: state is lost on restart; no session resumability for clients)
**Kind:** placeholder / incomplete implementation
**Issue:** The `InMemoryEventStore` is copied verbatim from the MCP TypeScript SDK examples and is explicitly documented as intended for examples and testing, not production. It stores SSE event history in a `Map` in process memory, so all session state is lost on any restart or crash, and there is no mechanism for clients to replay missed events across server restarts.
**Fix:** Replace with a persistent store (e.g. Redis, a database-backed event log) before any production deployment. The `EventStore` interface from `@modelcontextprotocol/sdk/server/streamableHttp` is already the right abstraction; only the implementation needs to change.
**Standalone:** yes; swap the implementation behind the existing `EventStore` interface; no changes to `app.ts` or the MCP server wiring

### MCP session map does not evict abandoned sessions

**File:** `apps/mcp-server/src/http/app.ts`
**Severity:** low (memory leak under adversarial or high-traffic conditions)
**Kind:** resource management
**Issue:** The `transports` map in `createHttpApp` is cleaned up when a client sends `DELETE` (via `onclose`) or on graceful shutdown. If a client disconnects without sending `DELETE` (network drop, crash), the transport entry persists for the lifetime of the process. For a low-traffic introspection server this is unlikely to matter in practice, but under adversarial conditions or bursty usage the map grows without bound.
**Fix:** Track a `lastSeenAt` timestamp per transport entry and update it on every request that resolves an existing session. Run a `setInterval` sweep (e.g. every 5 minutes) to close and evict sessions idle beyond a configurable TTL (e.g. 30 minutes). The sweep should call `transport.close()` before deleting the entry to ensure clean teardown.
**Standalone:** yes; self-contained change to `app.ts`; no protocol or API surface changes

### `NUMERIC_AGGREGATION_TYPES` in queryBuilder duplicates `esToAggTypesMap` from `modules/types`

**File:** `apps/mcp-server/src/arranger/queryBuilder.ts` (`NUMERIC_AGGREGATION_TYPES`)
**Severity:** low (duplication / drift risk)
**Kind:** duplication
**Issue:** The `execute_query` builder must know whether a field's generated GraphQL aggregation type is `NumericAggregations` (selected via `stats`) or `Aggregations` (selected via `buckets`). That classification lives in `esToAggTypesMap` in `modules/types/src/elastic/constants.ts`, but the MCP server does not depend on `modules/types`, so the builder carries a local `NUMERIC_AGGREGATION_TYPES` set mirroring it (plus the `number` display type used by catalogue configs). If `esToAggTypesMap` gains or corrects entries, the copy silently diverges and the builder would emit the wrong selection shape for affected field types.
**Fix:** Either add `@overture-stack/arranger-types` as an mcp-server dependency and derive the set from `esToAggTypesMap`, or (preferred) expose each field's aggregation kind in the catalogue introspection response so MCP consumers need no local mapping at all. The latter aligns with the introspection-as-contract direction of the MCP integration readiness roadmap items.
**Standalone:** yes; either fix is additive; no behaviour change for current field types

### `execute_query` duplicates the raw-to-GraphQL-name transform and handles only dots

**File:** `apps/mcp-server/src/arranger/queryBuilder.ts` (`toAggregationFieldName`, `renderSelectionTree`, and `documentType` handling)
**Severity:** medium (a whole class of catalogue field is unaddressable through `execute_query`; newly reachable, not theoretical)
**Kind:** duplication, with a live defect as its consequence
**Issue:** The server sanitizes field names into valid GraphQL identifiers via `sanitizeGraphqlFlatName` in `@overture-stack/arranger-types/tools`: dots become `__`, every character GraphQL disallows becomes `_`, and a leading digit gets an `_` prefix. `apps/mcp-server` carries its own copy of only the first of those rules. `toAggregationFieldName` produces `biomarker__ca19-9_level` where the generated schema exposes `biomarker__ca19_9_level`; `renderSelectionTree` emits raw path segments straight into the hits selection set; and `documentType` is used unsanitized both to write the query and to read `response.data[documentType]`, while the schema now sanitizes it. So `execute_query` cannot address any field or document type whose name contains a character GraphQL disallows, or starts with a digit, in hits, sorts, or aggregations alike.

Before the GraphQL name sanitization work such a catalogue failed to build at all, so this was unreachable. Now the catalogue builds and the gap is live, which is what makes this worth logging rather than filing under general duplication. Hyphens and leading digits are common in biomarker and clinical field naming, the exact case that work was done for.

**`build_sqon` is unaffected**, and it is worth recording why, so a future change does not quietly break it: catalogue introspection keys `fields` on raw ES dotted paths and exposes no sanitized name at all, and a SQON reaches Arranger as a GraphQL variable (`variables = { filters: sqon }`), never inside the query document, so a `fieldName` in a SQON is never parsed as a GraphQL identifier. Both conditions hold today. Inlining a SQON into a query string would break the second one.

**Fix:** Depend on `@overture-stack/arranger-types` and use `sanitizeGraphqlFlatName` for the aggregation name, the hits selection set, and `documentType`, replacing the local transform. The same duplicated transform exists in the UI packages (`LiveAdvancedFacetView.js`, `Aggregations.jsx`, `Stats.jsx`, `charts/arranger/mapping.ts`), each also handling only dots: see the roadmap's [Storybook item](roadmap.md#storybook-or-similar-for-modulescomponentsmodulescharts-carrying-their-own-integration-tests), which names them and records that this duplication already let one cross-package mismatch ship unnoticed. `apps/mcp-server` was not on that list and is now the fifth copy. The durable fix is for all of them to call the one canonical function; doing mcp-server alone still fixes a live defect and is worth doing on its own.
**Standalone:** yes, though it adds `@overture-stack/arranger-types` as an mcp-server dependency, which the `NUMERIC_AGGREGATION_TYPES` entry above also wants. Do both in one pass if either is picked up. Needs a catalogue with a hyphenated or leading-digit field to test against; no existing fixture has one.

### Introspection types should be Zod-first and moved to `modules/types`

**File:** `apps/mcp-server/src/arranger/types.ts`; `apps/search-server/src/introspection/types.ts`
**Severity:** low (fragile cross-package import; duplication risk)
**Kind:** design improvement
**Issue:** Two related problems introduced together:

1. `apps/mcp-server/src/arranger/types.ts` imports directly from `'../../../search-server/src/introspection/types.js'`: a raw file-path reference into another app's source tree, bypassing the package boundary. If `search-server` restructures its internals, the import silently breaks with no compile-time protection at the package level.
2. `types.ts` duplicates the introspection shape as local Zod schemas because `search-server` exposes only TS interfaces, not Zod schemas. When the introspection shape changes, both the interfaces and the local Zod schemas must be updated in sync.
   **Fix:** Move introspection types into `modules/types` (the existing shared-types package). Define them as Zod schemas there and infer the TS types: `export const CatalogIntrospectionSchema = zod.object({...}); export type CatalogIntrospection = zod.infer<typeof CatalogIntrospectionSchema>`. Both `search-server` and `mcp-server` import from `@overture-stack/arranger-types`: one schema definition, no raw cross-app file paths, and `mcp-server` can reference the schemas directly as MCP `outputSchema` values. The `TODO` comment in `apps/mcp-server/src/arranger/types.ts` tracks this.
   **Standalone:** no; depends on `modules/types` tsup build being in place (already done); coordinate with the Zod-first types work

### `mcp-server` pins Express 4 and Zod 3; `@modelcontextprotocol/sdk` uses Express 5 and Zod 4 internally

**File:** `apps/mcp-server/package.json`
**Severity:** low-medium (version skew; potential for subtle type or behaviour divergence as the MCP SDK evolves)
**Kind:** dependency management
**Issue:** `mcp-server` explicitly pins `express: ^4` and `zod: ^3` for consistency with the rest of the monorepo, but `@modelcontextprotocol/sdk` bundles Express 5 and Zod 4 internally. The two copies coexist for now without breakage, but if the SDK exposes types that depend on its internal Zod 4 schemas at the boundary with our Zod 3 code, assignments can fail at runtime in ways that TypeScript won't catch. The Express gap is lower risk (the SDK's Express is an implementation detail) but should be resolved before the monorepo-wide Express upgrade.
**Fix:** Coordinate a monorepo-wide upgrade: Express ^4 to ^5 across all packages, then Zod 3 to Zod 4 (Zod 4 has breaking API changes; audit all `.parse()`, `.safeParse()`, and `.refine()` usages). `mcp-server` should be updated in the same pass, not ahead of the rest of the repo.
**Standalone:** no; requires coordinated upgrade across all workspace packages; do not upgrade `mcp-server` in isolation

### MCP endpoint has no authentication (URGENT: block demo deployment)

**File:** `apps/mcp-server/src/http/app.ts` (`createHttpApp`); `apps/mcp-server/src/utils/config.ts` (`envSchema`)
**Severity:** critical (OWASP A01: Broken Access Control; any reachable agent can invoke all tools and read all catalogue data)
**Kind:** missing security control
**Issue:** The MCP endpoint accepts all incoming requests with no authentication check. In a demo or staging environment accessible over a network, any agent or automated client that can reach the port can call `list_catalogues`, `get_catalogue_fields`, and `execute_query` without restriction. There is no API key, bearer token, client certificate, or IP allowlist in place.
**Fix:** Add a configurable API key check as middleware in `createHttpApp`, applied before the `postHandler` and `sessionHandler` routes. Read the key from a `MCP_API_KEY` env var; if set, reject requests that do not include `Authorization: Bearer <key>` with a `401`. If unset, warn at startup that the endpoint is unauthenticated. For demo environments, always set `MCP_API_KEY`. For production, explore OAuth 2.0 or mTLS as a stronger option. The MCP SDK does not impose an auth mechanism; the middleware layer is the correct place to enforce it.
**Standalone:** yes; self-contained middleware addition to `app.ts` plus one new env var in `config.ts`

### MCP endpoint has no rate limiting (URGENT: block demo deployment)

**File:** `apps/mcp-server/src/http/app.ts` (`createHttpApp`)
**Severity:** high (OWASP A05: Security Misconfiguration; adversarial agents can flood the endpoint and exhaust memory or downstream Arranger connections)
**Kind:** missing security control
**Issue:** There is no per-client or global request rate limit on the MCP endpoint. An adversarial agent can:

- Open a large number of concurrent sessions, filling the `transports` map (memory exhaustion; see existing session-map entry).
- Issue rapid-fire tool calls within a single session, generating a corresponding flood of HTTP requests to Arranger.
  Neither the MCP transport layer nor Express applies any backpressure.
  **Fix:** Add `express-rate-limit` middleware (already in the Express ecosystem, no new dependency category) in `createHttpApp` before the route handlers. Apply two limits: (1) a per-IP initialization limit (e.g. 10 new sessions per minute) on `isInitializeRequest` paths to cap session creation; (2) a per-session or per-IP request limit on all MCP requests (e.g. 60 tool calls per minute). Make limits configurable via `MCP_RATE_LIMIT_INIT_RPM` and `MCP_RATE_LIMIT_CALLS_RPM` env vars with conservative defaults.
  **Standalone:** yes; middleware addition to `app.ts`; new env vars in `config.ts`

### `get_catalogue_fields` does not validate `catalogueId` against the configured allowlist

**Status (2026-08-10):** narrowed, not closed. `build_sqon` shipped with the check, so the entry no longer covers all three catalogue-taking tools: `get_catalogue_fields` and `execute_query` still forward an unchecked `catalogueId`.

**File:** `apps/mcp-server/src/mcp/tools.ts` (`get_catalogue_fields` tool handler); `apps/mcp-server/src/mcp/executeQueryTool.ts`
**Severity:** medium (OWASP A03: Injection; unvalidated ID forwarded into URL path; also information disclosure if Arranger hosts undeclared catalogues)
**Kind:** missing input validation
**Issue:** The `get_catalogue_fields` tool accepts any non-empty string as `catalogueId` and forwards it directly to `client.getCatalogueIntrospection(catalogueId)`, which calls `GET /introspection/{catalogueId}` on Arranger. The `ARRANGER_CATALOGUES` config declares the intended allowlist, but the tool never checks it. An adversarial agent can probe arbitrary strings: either to enumerate undeclared catalogues on the Arranger instance, or to attempt path traversal in the constructed URL (e.g. `../sqon`).
**Fix:** `resolveCatalogue` in `apps/mcp-server/src/mcp/buildSqonTool.ts` is the reference implementation: it checks membership in `config.catalogues` before any HTTP call, so an unvalidated identifier never reaches Arranger's URL path, and returns a message naming the configured catalogues instead. Lift it into a shared module (`arranger/` is the right home, as it takes a client and a config and no MCP surface) and call it from all three tools. The config is already available via `deps` in `registerTools`. Doing it as a lift rather than three copies also closes the entry below in the same pass, since `resolveCatalogue` handles both problems together.
**Standalone:** yes; extracting one existing function and calling it from two more handlers; no new dependencies

### `integration-tests/mcp-server` is never typechecked

**File:** `integration-tests/mcp-server/tsconfig.json`; `integration-tests/mcp-server/package.json` (`test` script)
**Severity:** low (no runtime defect; type errors in the suite and in the app source it imports go unnoticed)
**Kind:** test infrastructure gap
**Issue:** The suite runs under `tsx --test`, which strips types without checking them, and no script invokes `tsc` for this project. Its `tsconfig.json` also omits `strict`, unlike `apps/mcp-server`'s, so pointing `tsc` at it produces spurious errors instead of real ones: without `strictNullChecks`, Zod infers every schema property as optional, and `apps/mcp-server/src/mcp/*.ts` reports ~8 assignability errors that its own strict config does not. Running with `--strict` instead surfaces ~12 genuine pre-existing errors across `index.test.ts` (`esClient` possibly undefined, an `enableNetworkAggregation` option that no longer exists on `ArrangerServer`'s config type), `readResources.ts` (text/blob content union not narrowed), and `modules/graphql-router`.
**Fix:** Add `"strict": true` to the project's `tsconfig.json`, fix the errors it surfaces, and add a `typecheck` script so the suite is checked rather than only executed. Worth doing alongside the same treatment for `integration-tests/server` and `integration-tests/import`, which likely share the shape.
**Standalone:** yes, but not a one-liner: enabling strict is the easy half, the ~12 errors it exposes are the work

### `SQON_CHEAT_SHEET`'s remaining consumer needs a keep-or-drop decision now that `build_sqon` has shipped

**Status (2026-08-10):** narrowed, not closed. `build_sqon` has shipped, and parts (a) and (b) of the fix below are done: `execute_query`'s description now routes through `build_sqon`, and `query_arranger` no longer sends the cheat sheet or carries a `## SQON grammar` section. Only part (c) is open, so the cheat sheet now has **one** consumer, `get_sqon_schema`.

**File:** `apps/mcp-server/src/mcp/sqonCheatSheet.ts`; consumed by `src/mcp/tools.ts` (`get_sqon_schema`)
**Severity:** low (no defect today; this is a scheduled-obsolescence marker so the cheat sheet is not maintained past its usefulness)
**Kind:** anticipated redundancy
**Issue:** The cheat sheet exists to help an LLM synthesize raw SQON by hand. [SQON generation via `build_sqon` tool](roadmap.md#sqon-generation-via-build_sqon-tool-done) removes the LLM from the synthesis loop entirely: the LLM selects field, operator, and value, and the tool generates validated SQON. At that point the cheat sheet's primary job is gone. `.dev/docs/build-sqon-tool.md` already anticipates this and leaves "keep it as a human-facing reference?" as a separate decision.

Two things make this worth tracking rather than leaving implicit in the design doc:

1. As of 2026-07-27 the cheat sheet has **two** consumers, not one. It was extracted from `tools.ts` into its own module so `query_arranger` could send it inline as text (replacing an embedded resource that carried the raw JSON Schema, which is the validation artifact rather than a generation guide). Retiring it is therefore a two-site decision: the `get_sqon_schema` tool text, and the prompt's second message plus its `## SQON grammar` section.
2. Inlining it into the prompt is exactly the "SQON schema in a system prompt costs tokens on every request" pattern `build_sqon` was designed to avoid. It is a net reduction against what the prompt sent before (the cheat sheet is smaller than the raw JSON Schema, and it caches cleanly in a stable prefix), so it is an improvement on the status quo, not a new cost. But it is not the destination.

**Fix:** When `build_sqon` ships, revisit all three surfaces together: (a) rewrite `execute_query`'s description from "call `get_sqon_schema`, then write a `sqon`" to "call `build_sqon`, then pass its output"; (b) drop the cheat-sheet message and the `## SQON grammar` section from `query_arranger`, replacing them with a workflow step that calls `build_sqon`; (c) decide whether `get_sqon_schema` keeps the cheat sheet as human-facing text or returns only the machine-readable schema. Note this interacts with the **MCP surface unification** follow-on under [Deprecate `sqon-builder`](roadmap.md#deprecate-sqon-builder), which proposes deriving the cheat sheet from `getSqonFieldOperatorDetails()` so it stays in sync automatically. If `build_sqon` lands first, that derivation work may be unnecessary; sequence the two deliberately rather than doing both.
**Standalone:** no; gated on `build_sqon` shipping. Do not delete the cheat sheet ahead of that: it is currently the only SQON generation guidance the tools-only MCP clients ever receive, since most hosts do not implement the prompts primitive.

### `list_catalogues` and the `query_arranger` prompt list every configured catalogue with no regard for `status`

**File:** `apps/mcp-server/src/mcp/tools.ts` (`list_catalogues`); `apps/mcp-server/src/mcp/prompts.ts` (`formatCatalogueSummary`)
**Severity:** medium (a `failed` catalogue is recommended to the researcher as if queryable; `execute_query` against it then fails with no reason the model can act on other than retrying)
**Kind:** missing integration with a recently-shipped feature
**Issue:** [Multicatalog catalogue lifecycle and metadata](roadmap.md#multicatalog-catalogue-lifecycle-and-metadata) added `status`/`error` (`{code, message}`) to every entry in `GET /introspection`'s `catalogs` map, plus a top-level `status` for the server-wide aggregate. This lets a caller tell a catalogue that failed to build (missing index, unreachable cluster) apart from one that's actually available; overture-dev currently has 4 of its 5 catalogues `failed`. Neither MCP consumer reads that field.

`query_arranger`'s `formatCatalogueSummary` consumes `client.getServerIntrospection()` directly with no Zod validation, so the data reaches it untouched. It just isn't used: every catalogue's `id` and `documentType` render unconditionally.

`list_catalogues` is a deeper gap. `tools.ts` runs the response through `serverIntrospectionSchema.parse(data)` first. That schema (see the next entry) doesn't declare `status`/`error`, so Zod's default `.parse()` silently strips those keys before `list_catalogues`'s handler code ever runs. Filtering by `status` there is impossible until the schema is fixed.

Either way, an LLM using either surface has no way to know a listed catalogue is currently unusable until it calls `execute_query` and gets a 404.

**Fix:** Filter or annotate by `status` in both places: at minimum, exclude `failed` (and `disabled`) catalogues from `list_catalogues`'s output and from the prompt's catalogue summary, or surface `status`/`error` alongside each entry so the model can inform the researcher instead of silently picking an unusable catalogue. `query_arranger`'s fix is a self-contained rendering change; `list_catalogues`'s fix depends on the schema fix in the next entry.
**Standalone:** `query_arranger`'s half yes; `list_catalogues`'s half no, blocked on the schema entry below

### mcp-server's Zod schemas don't declare the 2026-07-24 catalogue status fields

**File:** `apps/mcp-server/src/arranger/types.ts` (`cataloguesSchema`, `serverIntrospectionSchema`, `catalogueIntrospectionSchema`)
**Severity:** medium (silently strips data for the listing schemas; throws for the per-catalogue schema, see the next entry)
**Kind:** missing integration with a recently-shipped feature
**Issue:** None of these three schemas were updated when Arranger's `GET /introspection` and `GET /introspection/:catalogueId` gained `status`/`error` (and a top-level `status`) on 2026-07-24. `cataloguesSchema`/`serverIntrospectionSchema` are plain `zod.object({...})`s with no `.passthrough()`, Zod v3 silently drops keys it doesn't recognize by default, so `list_catalogues` (which runs `serverIntrospectionSchema.parse(data)`) never sees `status` at all, not a rendering gap, the data is gone before that code runs. `catalogueIntrospectionSchema` is worse: it's covered in the entry below.
**Fix:** Add `status: zod.enum(['available', 'failed', 'disabled', 'loading'])` (optional `error: zod.object({ code: zod.string(), message: zod.string() })`, present only when `status === 'failed'`, omitted rather than `null` when `available`) to `cataloguesSchema`'s per-catalogue object, and a top-level `status` to `serverIntrospectionSchema`. Ideally done as part of the already-logged "Introspection types should be Zod-first" tech-debt item (see the `apps/mcp-server` section above), which would derive these schemas from `search-server`'s own Zod definitions instead of hand-maintaining a second copy that can drift like this.
**Standalone:** yes; schema-only change, unblocks the `list_catalogues` fix above

### `get_catalogue_fields` and `execute_query` throw a raw Zod validation error for a `failed` catalogue instead of a clean message

**Status (2026-08-10):** unchanged for these two tools, but no longer an open design question. `build_sqon` shipped handling this correctly, so the fix below has a working implementation to copy rather than choose between.

**File:** `apps/mcp-server/src/mcp/tools.ts` (`get_catalogue_fields`); `apps/mcp-server/src/mcp/executeQueryTool.ts`
**Severity:** medium (confirmed not a crash: the MCP SDK's tool dispatcher, `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js:138-144`, catches any thrown error and returns a normal `{ isError: true, content: [...] }` tool response; but the message shown to the calling agent is Zod's raw issue-array dump, not Arranger's already-correct, human-readable one)
**Kind:** bug
**Issue:** `catalogueIntrospectionSchema` requires `documentType`, `generatedAt`, `meta`, `operators`, and `fields`. A `failed` catalogue's `/introspection/:catalogueId` response (by design, see "Multicatalog catalogue lifecycle and metadata") has none of these: it's `{ catalogueId, status, error: { code, message }, details }`. `catalogueIntrospectionSchema.parse(data)` in both `tools.ts:68` and `executeQueryTool.ts` throws for that shape. An agent asking about a currently-down catalogue (the overture-dev case: 4 of 5) gets a confusing technical validation error at exactly the moment this whole feature was meant to hand it a clear "index not found" instead.
**Fix:** Take the second of the two approaches originally listed here, which is what `resolveCatalogue` in `apps/mcp-server/src/mcp/buildSqonTool.ts` already does: `safeParse` the raw response against a small `failedCatalogueSchema` (`{ status: 'failed', error?: { code, message } }`) _before_ calling `catalogueIntrospectionSchema.parse`, and short-circuit into a clean tool response quoting Arranger's own `error.code`/`error.message`. It avoids parsing twice and keeps the "what does a failed response look like" logic in one place. The other approach considered, unioning the two schemas and branching on `status` afterwards, is not needed. Lift `resolveCatalogue` into a shared module and call it from all three tools, which closes the allowlist entry above at the same time.
**Standalone:** yes; depends conceptually on the same status vocabulary as the two entries above but is a self-contained code change. Note this fix does not need the schema fix above: `resolveCatalogue` reads `status` off the raw response, before any schema that would strip it.

### `validateArrangerConnection` reports a `failed` catalogue as validated

**File:** `apps/mcp-server/src/arranger/validation.ts`
**Severity:** medium (false confidence at the one place explicitly meant to catch this at startup)
**Kind:** bug
**Issue:** The function's own docstring says it ensures "all configured catalogues are available," but it only checks that `client.getCatalogueIntrospection(catalogueId)` resolves without throwing, i.e. that the HTTP request succeeded, and never inspects the response body. A `failed` catalogue's metadata endpoint deliberately returns `200` (by design, so status stays reachable even when the catalogue itself is down), so this validation passes and logs "All configured catalogues validated" even when, per the current overture-dev deployment, 4 of the 5 configured catalogues are actually `failed`.
**Fix:** After fetching each catalogue's introspection, check its `status`; if `failed`, either throw (matching the function's existing "throw on any problem" contract) or downgrade to a `logger.warn` listing which catalogues are down and their `error.code`/`error.message`, rather than treating a `failed` catalogue identically to a missing one. Needs the schema fix above first (or an inline check against the raw response) since the current `catalogueIntrospectionSchema` can't represent a `failed` response at all.
**Standalone:** mostly yes; sequence after the schema fix above so it isn't done against data Zod would otherwise strip

### `MCP_HOST` is parsed and validated but never actually used to bind the server, and the SDK's own Host-header protection silently misfires as a result

**File:** `apps/mcp-server/src/server.ts:37-38`; `apps/mcp-server/src/http/app.ts:80`
**Severity:** high
**Kind:** bug/security
**Issue:** `config.mcp.host` is destructured at `server.ts:37` (confirmed directly), but the very next line calls `app.listen(port, () => {...})` with no host argument, so the server always binds to all interfaces regardless of `MCP_HOST` (documented default `0.0.0.0` per `.env.schema`/`README.md`). An operator setting `MCP_HOST=127.0.0.1` specifically to restrict exposure (e.g. behind a sidecar) has that setting silently ignored. Compounding this, `createHttpApp` calls `createMcpExpressApp()` with no arguments at all (`http/app.ts:80`); per the MCP SDK's own source, an omitted `host` defaults to `'127.0.0.1'`, which makes the SDK silently apply `localhostHostValidation()`, Host-header validation that only accepts `localhost`/`127.0.0.1`/`[::1]`. Since the real bind address is (by default) `0.0.0.0`, network-reachable, this means: (1) a real client whose `Host` header isn't literally `localhost`/`127.0.0.1` (a Kubernetes Service DNS name, an ingress hostname) gets a 403 "Invalid Host" rejection from this middleware; and (2) the SDK's own protective warning about binding `0.0.0.0` without DNS-rebinding protection never fires, because the SDK is never told the true host, so there's no signal that `allowedHosts` should be configured. This is invisible in the integration-test suite specifically because `integration-tests/mcp-server/test/startMcpServer.ts:38` calls `app.listen(port, host, ...)` correctly and substitutes `127.0.0.1` for `0.0.0.0` when building the test's connection URL, so tests always present a `Host` header that happens to pass.
**Fix:** Thread `config.mcp.host` through to both call sites: `app.listen(port, host, callback)` in `server.ts`, and `createMcpExpressApp({ host, allowedHosts })` in `createHttpApp` (accepting `allowedHosts` as a new, documented env var for non-localhost deployments), matching what the integration test harness already does correctly.
**Standalone:** yes.

### `get_catalogue_fields`'s tool description and README promise a per-field `description` that doesn't exist anywhere in the pipeline

**File:** `apps/mcp-server/src/mcp/tools.ts:58`; `apps/mcp-server/README.md:15`
**Severity:** medium
**Kind:** docs-drift
**Issue:** The `get_catalogue_fields` tool description states: "`fields` lists each field with its `type`, `displayName`, optional `unit`, and optional `description`." The README repeats the claim. No per-field `description` property exists anywhere in the pipeline: `buildFields` (`modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts:23-35`) only emits `displayName`/`type`/optional `unit`; `apps/search-server/src/introspection/types.ts:46-50`'s `CatalogFieldIntrospection` type has no `description`; `apps/mcp-server/src/arranger/types.ts:71-75`'s Zod `fieldSchema` also omits it. Per-field descriptions are still open future work (see roadmap: "Field descriptions in the generated schema"). An LLM reading this tool description is told to expect a field that will never be present.
**Fix:** Remove "and optional `description`" from both the tool description in `tools.ts` and the README table until per-field descriptions actually ship, then re-add once they do.
**Standalone:** yes.

---

## apps/search-server

### `ENABLE_ADMIN` is read from the environment and reaches no consumer, and the docs describe the wrong channel

**Files:** `apps/search-server/src/configs/fromEnv/localEnvs.ts:84`; `apps/search-server/src/configs/fromEnv/aggregator.ts:17,42`; `apps/search-server/src/server.ts:21`; `docs/reference/07-feature-flags.md:44,48`
**Severity:** medium. Fails *closed* (admin surface stays off when an operator asks for it), so not a disclosure risk, but the flag does not do what it is documented to do and the documentation points at the one channel that does not work.
**Kind:** unwired feature flag plus incorrect documentation
**Issue:** Traced end to end. `localEnvs.ts:84` does read `process.env.ENABLE_ADMIN` via `stringToBool`, but places it at the **config root**. The aggregator destructures `enableAdmin` from `externalConfigs` only (`:17`) and merges it into **`catalogs.fromEnv.enableAdmin`** (`:42`), a different path, so the two never meet. `catalogs.fromEnv` is then the `baseConfig` for every catalogue config and flows to `arrangerRouter`, which destructures `enableAdmin` at `router.ts:72` and forwards it to `graphqlRoutes`, `createConnectionResolvers`, and `download`. The root-level value has one possible consumer, `server.ts:21`, and that destructure is `{ allowedCorsOrigins, catalogs, enableDebug, enableLogs, health, serverPort }`, which omits it. So the env var is parsed into a property nothing reads.

Only a programmatic `externalConfigs.enableAdmin` reaches a consumer. Note the contrast within the same group: `enableDebug` and `enableLogs` *are* destructured by `server.ts` and work as documented, so this is specific to `enableAdmin` rather than a broken pattern.

The documentation is then backwards for this flag specifically. `07-feature-flags.md:44` says the server-level group "cannot be set per catalogue in `base.json`", but per-catalogue is the only channel that works: `catalogs.fromEnv` is the base config that file JSON merges over, and file values win for every key (see the config-credential-override entry), so `"enableAdmin": true` in a `base.json` does take effect while the documented env var does not.

Compounding, separately tracked: even when `enableAdmin` is truthy, `router.ts` calls `downloadRoutes({ enableDebug })` without it, so `/download/fields` can never be enabled by any channel.

**Provenance:** reported by the feature-flags lens of the Phase 0 audit and deliberately *not* filed at the time, because the lens's claim conflicted with `aggregator.ts` visibly forwarding an `enableAdmin` and the origin of that value was unresolved. Traced to completion 2026-08-18; the lens was right, and the apparent conflict was two different config paths sharing a property name.
**Fix:** Decide the intended channel. If server-level as documented, destructure `enableAdmin` in `server.ts` and thread it to the catalogue configs; if per-catalogue, move the env read under `catalogs.fromEnv` in `localEnvs.ts` and correct `07-feature-flags.md:44` to exclude it from the server-level group. Either way, add the flag-toggles-behaviour test proposed elsewhere in this file, and extend it beyond `configArrangerFeatureFlagProperties`, since `enableAdmin` sits outside that group. Note the `FIXME` already on `constants.ts:20` saying this flag must be removed and the facets-versus-numeric-aggs coupling untangled, which may make removal the correct answer rather than repair.
**Standalone:** yes.

### No unit tests for `fromEnv/` env var aggregation

**Files:** `apps/search-server/src/configs/fromEnv/` (3 files)
**Severity:** low (`configs/index.ts`, `fromFiles/`, and `catalogueId.ts` have test coverage: see `fileHandlers.test.ts`, `configs/index.test.ts`, and `catalogueId.test.ts`; `fromEnv/` remains uncovered)
**Kind:** missing test coverage
**Issue:** `fromEnv/`'s env var aggregation (`aggregator.ts`, `localEnvs.ts`, and the third file in that directory) has no test coverage: defaults, override precedence when both an external config value and an env var are set, and type coercion (`stringToBool`/`stringToNumber`) aren't exercised directly.
**Fix:** Unit tests covering default values, external-config-overrides-env-var precedence, and coercion edge cases (empty string, non-numeric input).
**Standalone:** yes; no running server or filesystem required

### No README

**File:** `apps/search-server/`; no `README.md` present
**Severity:** medium (discoverability and onboarding gap; especially relevant for teams building on or deploying Arranger)
**Kind:** missing documentation
**Issue:** `apps/search-server` has no README. It is the primary runnable application in the monorepo (the thing operators deploy) but there is no document explaining how to run it, what env vars it accepts, how the config directory is structured, or how it relates to `modules/graphql-router`. The `.env.schema` file partially serves this purpose, but only for env vars, and is not discoverable without knowing to look there.
**Fix:** Add `apps/search-server/README.md` covering: what the app is, how to run it (`npm run server` from repo root), the env var reference (pointing at `.env.schema` for full schema, with the most important vars inline), the configuration directory structure (flat = single catalogue; subdirectories = multicatalogue), and a pointer to the `graphql-router` README for custom integrations.
**Standalone:** yes

### No boot-time warning when a network node config omits `nodeId`

**File:** `apps/search-server/src/configs/fromFiles/normalize.ts` (`normalizeNetworkConfig`); type declared optional in `modules/types` (see that section's `NetworkConfig.localNode` entry)
**Severity:** medium (silent feature degradation; multi-node deployments that skip `nodeId` lose per-node filtering and get ambiguous header matching with no indication anything is wrong)
**Kind:** missing operator-facing validation
**Issue:** `nodeId` is load-bearing for `NetworkNodesChart` rendering and for `filterNodesByNodeId`'s node-scoped filtering (see the `graphql-router` section), but the config type keeps it optional with no startup check. An operator who configures multiple remote/local nodes without `nodeId` gets no error and no warning: `normalizeNetworkConfig`'s custom-request header matching silently falls back to `graphqlUrl` + `displayName` matching (correct, but a quieter code path than `nodeId` matching), and any UI feature depending on `nodeId`-based node filtering simply won't work, discoverable only by an operator noticing the feature doesn't do anything.
**Fix:** In `normalizeNetworkConfig` (or wherever network config is validated at boot, alongside the existing `console.warn` calls in `apps/search-server/src/configs/fromFiles/fileHandlers.ts`), warn when `remoteNodeExtendedConfigs` (or the local node config) contains more than one node and any entry is missing `nodeId`. Message should name which node(s) lack it and note that node-scoped filtering and per-node chart features require it.
**Standalone:** yes; additive validation/logging only, no change to existing fallback-matching behaviour

### No graceful shutdown on SIGTERM/SIGINT

**File:** `apps/search-server/src/server.ts` (or wherever the HTTP server is started; currently no signal handling anywhere in the app)
**Severity:** medium (dropped in-flight requests on every pod termination/redeploy/scale-down in a Kubernetes deployment)
**Kind:** missing operational handling
**Issue:** The server has no `SIGTERM`/`SIGINT` handler. Kubernetes sends `SIGTERM` to a pod on termination (redeploy, scale-down, rolling update) and waits a grace period before `SIGKILL`; without a handler, the process either ignores the signal (relying on the default, which does not drain connections) or exits immediately, dropping any request still in flight rather than letting it finish. Found while surveying old stashed work: an early (2023) prototype of this server had a working `server.close()`-on-signal pattern that was never carried forward into the current implementation.
**Fix:** On `SIGTERM` and `SIGINT`, call the HTTP server's `close()` (stop accepting new connections, let in-flight ones finish) before `process.exit()`. Keep it simple: no need for the old prototype's extra `SIGUSR2` respawn-signal handling, which was itself an unfinished hot-reload experiment, not a production concern.
**Standalone:** yes; additive, no change to existing request handling

### A config file that fails to read (not just fails to parse) is silently dropped from the merged catalogue config

**File:** `apps/search-server/src/configs/fromFiles/fileHandlers.ts:23-30`
**Severity:** medium
**Kind:** bug
**Issue:** `readFileAsync`'s catch block only does `console.log('error?', error)` and returns `undefined`; the caller (`getConfigFromFiles`) filters out `undefined` entries before merging. An `fs.readFile` failure that isn't a missing-directory case, a permission error on one specific `.json` file, a file deleted between `readdir` and `readFile`, a file that's actually a directory, causes that file's config to silently vanish from the merged catalogue config with no error and a log line that identifies neither the file nor the actual problem. This is a different, still-open path from the one already fixed for malformed JSON (`getConfigFromFiles` now correctly throws on `JSON.parse` failure, per existing `fileHandlers.test.ts` coverage): those tests only cover the parse-failure path, not this read-failure path, which has no test at all.
**Fix:** Rethrow (or otherwise surface) the read error with the filename identified, consistent with how malformed JSON is now handled, rather than silently filtering the file out. Add a test with an unreadable file (e.g. `fs.chmodSync(path, 0o000)`) alongside the existing malformed-JSON tests.
**Standalone:** yes.

### Config-normalization functions are typed `any` at exactly the boundary where untrusted, freshly-parsed catalogue config first gets structural assumptions applied

**File:** `apps/search-server/src/configs/fromFiles/normalize.ts:22,34,92,120`
**Severity:** low
**Kind:** type-safety
**Issue:** `getNetworkConfig`, `normalizeNetworkConfig`, `normalizeTableConfig`, and the exported `normalize` all take `fileDataJSON: any`/`configFilesJson: any`. `normalizeTableConfig` indexes into this data assuming an array shape (`fileDataJSON[configRootProperties.TABLE][tableProperties.DEFAULT_SORTING].map(...)`, lines 99-104) with no check, at the one place a malformed config shape would be most useful to catch before it merges into a live catalogue config.
**Fix:** Type the parameter as `unknown` (or a `Partial<ArrangerConfigs<...>>`-like shape) and narrow before indexing, at minimum for `normalizeTableConfig`'s array access.
**Standalone:** yes.

### Catalogue config-directory file merge order is not guaranteed deterministic

**File:** `apps/search-server/src/configs/fromFiles/fileHandlers.ts:49-60`
**Severity:** low
**Kind:** bug/test-coverage
**Issue:** `getConfigFromFiles` merges every `.json` file in a catalogue's config directory via `files.reduce((acc, [name, data]) => merge({}, acc, normalized), ...)`, in whatever order `fs.readdir` returns them, with no explicit sort applied. Node's `fs.readdir` does not guarantee stable or alphabetical ordering across platforms/filesystems. Since lodash `merge` makes later entries win on overlapping keys, which file "wins" for a key defined in more than one config file depends on this unguaranteed order. `fileHandlers.test.ts`'s multi-file tests only use non-overlapping keys, so this is untested in either direction.
**Fix:** Sort filenames (e.g. alphabetically) before the reduce, so merge precedence is explicit and portable. Add a test with two files defining the same key to lock in the intended precedence.
**Standalone:** yes.

### 50MB JSON/urlencoded request body limit has no apparent justification and widens the pre-rate-limiting attack surface

**File:** `apps/search-server/src/server.ts:44-45`
**Severity:** low-medium
**Kind:** security
**Issue:** `app.use(json({ limit: '50mb' }))` and `app.use(urlencoded({ extended: false, limit: '50mb' }))` accept request bodies up to 50MB. There is no file-upload or bulk-ingest path in `search-server` (no `multipart` handling anywhere in `modules/graphql-router/src`); an ordinary GraphQL query plus variables (including a SQON filter) is normally KB-sized. This limit is unchanged since the earliest version of this file and reads as a carried-over default rather than a deliberate sizing decision. Combined with the already-tracked absence of request rate limiting, and the fact that GraphQL alias/depth limits only apply after body parsing completes, a needlessly large accepted body widens the per-request memory footprint available to a careless or adversarial client before any other protection engages.
**Fix:** Lower the limit to something proportionate to real SQON/query sizes (e.g. 1–5MB), configurable via an env var if some deployment genuinely needs larger bodies. Worth doing together with, but not blocked on, the tracked rate-limiting work.
**Standalone:** yes.

---

## docs [URGENT: reminder every session]

### Inconsistent user-facing terminology: directory/folder, configuration/settings, docs prose

**Files:** `README.md:13`; `apps/search-server/configTemplates/configs.json.schema:6,29`; `apps/search-server/src/configs/index.ts:49,53,82`; `.dev/roadmap.md:216-230` (opportunistic)
**Severity:** low (reader confusion, no functional impact)
**Kind:** terminology drift
**Issue:** Two clusters of inconsistency found during a terminology audit. Canonical definitions are now in `docs/concepts.md`. `docs/reference/01-arranger-configs.md` was also flagged originally but is now clean after its 2026-07-07 rewrite; no longer part of this entry.

1. "folder" vs "directory": "directory" is canonical. "folder" appears in README.md:13, `configTemplates/configs.json.schema:6`, and in code identifiers (`buildCataloguesFromFolder`, `folderName` in `apps/search-server/src/configs/catalogueId.ts:18,20`) that surface in console output. The catalog→catalogue rename already landed on this function's name; only the folder→directory half remains. Console messages in configs/index.ts mix "directories" (line 53) and "subdirectories" (lines 49, 82) for the same concept.

2. "settings" vs "configuration": "configuration" is canonical for Arranger-level concepts. "Settings" appears in configs.json.schema:29 ("Settings and limits for dataset downloads") and roadmap.md:216-230 (Arranger-level prose, "server-level settings" / "index settings"). Leave ES mapping file "settings" keys and ES-referencing prose untouched.

3. Docs sidebar ordering: docs/concepts.md was added with sidebar_position: 2, and overview.md and setup.md were given sidebar_position: 1 and 3. Still true; if the docs site is published from overture.bio (no sidebar.js found in this repo), that site's sidebar config also needs docs/concepts.md added.

**Fix:** (a) Docs/schema comments pass: update README.md:13 and configs.json.schema:6, and console strings in configs/index.ts. (b) Identifier rename pass (separate commit): `buildCataloguesFromFolder` -> `buildCataloguesFromDirectory`, `folderName` -> `directoryName` in `apps/search-server/src/configs/`. (c) Cross-references: introduce "filter clause" for leaf nodes in `docs/reference/04-sqon-in-detail.md`.
**Standalone:** yes; (a) is docs-only; (b) is a mechanical rename; (c) is a docs addition. All three independent.

### Arranger Components has no published docs page

**File:** `docs/setup.md` ("Running the Arranger Components" section)
**Severity:** medium (blocks UI developers from self-serving setup)
**Kind:** missing documentation
**Issue:** `setup.md` has a "Coming Soon" placeholder for Arranger Components development setup and Storybook integration. No usage page exists for the React component library. UI developers and portal integrators have no documented starting point.
**Fix:** Add a `docs/reference/` page covering component installation, the development environment setup, and Storybook integration. Remove the "Coming Soon" placeholder in `setup.md` once that page exists.
**Standalone:** yes; independent of all other docs work

### `search-engine-integration.md` is developer-only; not published on docs.overture.bio

**File:** `.dev/docs/search-engine-integration.md`
**Severity:** medium (the permission reference is complete and useful; operators cannot reach it)
**Kind:** documentation visibility gap
**Issue:** `docs/setup.md` now links to `.dev/docs/search-engine-integration.md` for the full permissions reference. That file is only accessible in the repository; it is not published to docs.overture.bio. Operators who are not browsing the repo directly cannot reach this reference.
**Fix:** Promote `search-engine-integration.md` to a published page under `docs/reference/` (or a new `docs/operations/` section). Update the link in `setup.md` accordingly.
**Standalone:** yes; content is already complete; this is a placement and linking task only

### `02-query-processing.md` tip callout does not link to the practical SQON guide

**File:** `docs/reference/02-query-processing.md`
**Severity:** low (readability and navigation)
**Kind:** cross-link gap
**Issue:** The query processing page explains the pipeline conceptually but has no link to `03-building-sqon-queries.md`, which is the practical follow-up showing how to construct SQONs. Readers who want to go from theory to implementation have no signpost.
**Fix:** Add a tip callout at the bottom of `02-query-processing.md` pointing to `03-building-sqon-queries.md`.
**Standalone:** yes; one-line docs addition

### No published docs page for the liveness/readiness health endpoints

**File:** none exists; would live at `docs/reference/` (e.g. `09-health-checks.md`) or as a new section in `docs/setup.md`
**Severity:** low (operators can still find the endpoints in `.env.schema`/code; no self-serve reference for deployment/probe configuration)
**Kind:** missing documentation
**Issue:** Neither `/ping` (liveness, process-alive only, deliberately blind to catalogue state) nor `/ready` (readiness, added 2026-07-24, reflects the `healthy`/`degraded`/`unhealthy` catalogue aggregate from `GET /introspection`, see "Multicatalog catalogue lifecycle and metadata" in `roadmap.md`) is documented anywhere in `/docs`. This isn't a staleness gap, no page ever covered this; someone wiring up Kubernetes probes, a load balancer health check, or any other deployment tooling against these endpoints has to read the source to know they exist, what they return, or the distinction between the two (in particular, why liveness must never depend on catalogue/search-engine state, an easy anti-pattern to fall into).
**Fix:** Add a docs page or section covering both endpoints: path (configurable via `PING_PATH`/`READY_PATH`), response shape, HTTP status semantics (`/ready` returns `503` only when `unhealthy`), and the liveness-vs-readiness distinction with the reasoning for why liveness stays catalogue-blind. Cross-link from `GET /introspection` in `05-introspection.md`, since its top-level `status` there is the same computation `/ready` uses.
**Standalone:** yes; documentation addition only, no code changes

### README, package.json engines and the Dockerfiles disagree on the Node version

**Files:** `README.md:21`; `package.json` (`engines.node`); `docker/Dockerfile.local:13,27,83`; `docker/Dockerfile.jenkins:13,36`
**Severity:** medium (a contributor following the README may install a version the tooling does not actually want, and the published `engines` constraint is what consumers of the packages resolve against)
**Kind:** prerequisite drift across three sources of truth
**Issue:** Three different Node versions are stated for the same project. `README.md` lists "Node.js (v22 or higher)" under Development Environment, `package.json` declares `engines.node: ">=20.0.0"`, and every stage in both Dockerfiles builds `FROM node:24-alpine`. There is no `.nvmrc`, `.node-version`, or `volta` block to break the tie, and no CI workflow in this repo to infer the tested version from. Found while fixing link hygiene in the README, so the docs half was in scope but resolving the disagreement is not a documentation question: which value is correct depends on what the tooling actually requires and what the published packages intend to support.
**Fix:** Decide the authoritative version first, then make the three agree. Likely shape: pin the intended development version in a `.nvmrc` (or `volta`) so there is one machine-readable source, set `engines.node` to the lowest version actually supported by consumers (which may legitimately stay below the development version), align the Dockerfiles, and have the README cite the pinned value rather than restating a number. Note the README claim was deliberately left untouched pending this decision.
**Standalone:** no; needs a decision on the supported and intended Node versions before any file changes
**Correction (2026-08-17):** `DEVELOPMENT.md:11` states the identical "v22 or higher" claim as `README.md:21` but isn't in this entry's file list; fix it in the same pass or it'll still disagree once the other three are resolved.

### `docs/concepts.md` documents a `fuzzy` SQON operator that does not exist

**File:** `docs/concepts.md:57,92`
**Severity:** high (a reader following this doc constructs an invalid SQON that fails schema validation)
**Kind:** stale documentation
**Issue:** Both lines present `fuzzy` as an existing, implemented operator on equal footing with `wildcard` ("Text-search operators (`wildcard`, `fuzzy`)..."). It isn't: `modules/sqon`'s leaf-node schema union has no `fuzzy` branch (`InLikeFilterSchema`/`AllFilterSchema`/`RangeLikeFilterSchema`/`BetweenFilterSchema`/`WildcardFilterSchema` only), and a filter with `op: "fuzzy"` fails validation outright. `CHANGELOG.md` (the entry that renamed `filter` to `wildcard`) explicitly says fuzzy/edit-distance matching "does not exist yet." `docs/reference/04-sqon-in-detail.md:224` gets this right (uses "fuzzy" only to name the not-yet-built concept being contrasted against); `concepts.md` is the only page with the incorrect claim. See also the roadmap's "Fuzzy (edit-distance) SQON operator" Features item, this is the real, planned-but-unbuilt op the doc is prematurely describing as shipped.
**Fix:** Remove `fuzzy` from both `concepts.md` lines, or rephrase as "wildcard (and a planned future `fuzzy` operator, not yet implemented)."
**Standalone:** yes; two-line docs fix.

### `hits`'s `score` field is declared in the schema and documented as always populated, but the resolver never assigns it

**File:** `docs/reference/graphql-api.md:78` ("Every `node` has `id` and `score`"); `modules/graphql-router/src/mapping/createConnectionTypeDefs.js:52` (schema declares `score: Int`); `modules/graphql-router/src/mapping/resolveHits.js:164-169` (node assembly assigns `id` only, never `hit._score`)
**Severity:** medium
**Kind:** bug + stale documentation
**Issue:** The field is genuinely queryable (declared in the schema), so the doc's claim isn't nonsensical, but `resolveHits.js`'s node-building (`Object.assign(source, { id: hit._id }, nested_nodes, copied_to_nodes)`) never copies ES's `hit._score` onto the returned node. Querying `score` on any hit resolves to `null` unconditionally, regardless of the `score` query argument or the real ES relevance score, contradicting the doc's claim outright.
**Fix:** Either document that `score` is currently non-functional (always null) and that the `score` argument only toggles `track_scores` server-side without surfacing the value, or fix the resolver to assign `score: hit._score` and let the existing doc claim become true.
**Standalone:** no for the code fix (a behavioural change); yes for a docs-only caveat in the meantime.

### `hits`'s `before`/`after`/`last` GraphQL arguments are silent no-ops, and this isn't documented anywhere

**File:** `docs/reference/graphql-api.md:67-76` (arguments table omits all three); `modules/graphql-router/src/mapping/createConnectionTypeDefs.js:22-33` (schema declares them); `modules/graphql-router/src/mapping/resolveHits.js:253` (resolver never destructures them)
**Severity:** medium
**Kind:** missing documentation
**Issue:** The GraphQL schema exposes `before`/`after`/`last` on `hits`, the standard Relay cursor-pagination triad, but the resolver never reads any of the three: passing them has no effect, no error, no warning, the query just runs as if they weren't there. An integrator who reasonably tries them (they look like standard, well-known arguments) wastes time debugging a silently-ignored parameter. `docs/reference/06-defaults-and-limits.md` exists specifically to catalogue "invisible" default/query behaviour not visible through introspection; this is the inverse problem, a visible-through-introspection argument that is invisibly dead, and isn't covered there either.
**Fix:** Document `before`/`after`/`last` as accepted-but-unimplemented in `graphql-api.md`, or remove them from the schema if there's no plan to implement them (a separate, larger decision).
**Standalone:** yes for the docs half.

### `ROW_ID_FIELD_NAME`/`rowIdFieldName` (a real, shipped 3.1 config option) has zero coverage anywhere in `/docs`

**File:** none in `docs/`; natural home is `docs/reference/01-arranger-configs.md`'s `table.json` section or `docs/reference/06-defaults-and-limits.md`
**Code:** `apps/search-server/src/configs/fromEnv/localEnvs.ts:71`; `modules/types/src/configs/constants.ts` (`tableProperties.ROW_ID_FIELD_NAME`, default `'id'`); `apps/search-server/.env.schema`
**Severity:** medium
**Kind:** missing documentation
**Issue:** Per `CHANGELOG.md`, this is "the ES field used as the row identifier, previously hardcoded", a real, shipped 3.1 feature, with zero mention anywhere in `docs/`. `01-arranger-configs.md`'s `table.json` section documents `columns` only; `06-defaults-and-limits.md` documents the sibling `table.maxResultsWindow` default in the same table but omits this one. It is, however, documented correctly in `modules/graphql-router/README.md`, so the gap is specific to the published docs site.
**Fix:** Add a row to `01-arranger-configs.md`'s `table.json` section documenting `rowIdFieldName` (default `id`), and/or add the env var to `06-defaults-and-limits.md` alongside `maxResultsWindow`.
**Standalone:** yes.

### `useChartsContext` is a real, exported building-block hook with zero doc mention

**File:** none in `docs/charts.md` (documents `ChartsProvider`, `ChartsThemeProvider`, `BarChart`, `SunburstChart`, `NetworkNodesChart` only)
**Code:** `modules/charts/src/main.tsx` (exports `useChartsContext`); `modules/charts/src/components/Provider/Provider.tsx:184-190` (implementation); `modules/charts/src/components/Provider/chartsContextTypes.ts:44-51` (`ChartContext` shape: `registerChart`, `deregisterChart`, `getChartData`, `getNetworkChartData`, `getNetworkNodesData`, `requireNetworkSearch`)
**Severity:** medium
**Kind:** missing documentation
**Issue:** Same pattern already confirmed twice elsewhere this session (`DownloadButton`'s custom exporter, `Aggregations`'s `onValueChange`): a real, working, non-trivial public API with no doc page or mention at all. This is the mechanism a consumer would need to build a custom chart type beyond the three shipped ones. Distinct from the also-exported but genuinely non-functional `HeadlessChart` (see the `modules/charts` section below), which is correctly left undocumented since documenting it would be documenting a crash.
**Fix:** Add a "Building a custom chart" section to `docs/charts.md` documenting `useChartsContext` and the `ChartContext` shape, or at minimum note its existence and point to the source for now.
**Standalone:** yes.

### `graphql-router` README documents `mergeConfigs` as a public export; it isn't one

**File:** `modules/graphql-router/README.md:240-242` ("Other exports"); `modules/graphql-router/src/index.ts` (only re-exports `default` from `router.js`; `mergeConfigs` is `export const` inside `router.ts` but never re-exported from the package root); confirmed against `dist/index.d.ts`, which also has no `mergeConfigs`
**Severity:** medium (a documented, named import that fails at runtime for any consumer who follows the README)
**Kind:** stale documentation
**Issue:** The README lists `mergeConfigs` in "Other exports" alongside `buildSearchClient` and `resolveCatalogueFields` (both of which genuinely are exported from the package root), implying the same importability: `import { mergeConfigs } from '@overture-stack/arranger-graphql-router'`. That import fails; `mergeConfigs` is internal-only, consumed by `arrangerRouter` and `router.test.ts`. This README is linked directly from `docs/reference/08-Migration/v3.1.md`, making it the de facto reference page for this claim, not merely an internal note.
**Fix:** Either add `mergeConfigs` to `src/index.ts`'s exports (making the README true), or remove/correct the README entry to note it's internal-only.
**Standalone:** yes.

### `CHANGELOG.md` gives the new `modules/sqon` package the wrong name in one of two mentions

**File:** `CHANGELOG.md:25` (`@overture-stack/arranger-sqon`) vs `CHANGELOG.md:111` (correctly `@overture-stack/sqon`, same "Unreleased [3.1.0]" section)
**Severity:** low (self-correcting within the same changelog section; the actually-published docs are right)
**Kind:** stale documentation
**Issue:** The real package name (per `modules/sqon/package.json`) is `@overture-stack/sqon`, matching what `docs/reference/03-building-sqon-queries.md` uses consistently throughout. `CHANGELOG.md:25` has a one-off leftover/typo name.
**Fix:** Change `CHANGELOG.md:25` to `@overture-stack/sqon`.
**Standalone:** yes; one-line fix.

### `docs/overview.md` and `AGENTS.md` inconsistently mark the two deprecated admin directories, and a prior partial fix never propagated

**File:** `docs/overview.md:66,85,87`; `AGENTS.md:49-56`
**Severity:** low
**Kind:** stale documentation
**Issue:** `docs/overview.md:87` correctly marks `modules/admin-ui/` as "(Inactive)... a replacement is planned," but `integration-tests/admin/` (line 66) carries no such marker, and the surrounding prose describing `integration-tests/` ("Full-stack integration test suites that run against a live Elasticsearch instance") makes no carve-out for it, misleadingly implying it's a live suite like its siblings. `DEVELOPMENT.md` already had both `admin-ui` and `integration-tests/admin` removed from its own structure listing in an earlier pass; that fix never propagated to `docs/overview.md`. `AGENTS.md:49-56`'s own structure diagram has the mirror-image inconsistency (drops `admin-ui` silently but keeps `integration-tests/admin` unmarked) and separately omits `mcp-server` (both the module and integration-tests directories) and `modules/charts` entirely.
**Fix:** Mark `integration-tests/admin/` as "(Inactive)" in `docs/overview.md` alongside `modules/admin-ui/`, or remove both from the structure listing to match `DEVELOPMENT.md`'s precedent. Align `AGENTS.md`'s diagram at the same time, or drop the now-nonexhaustive `admin` mention from it entirely.
**Standalone:** yes.

### `DEVELOPMENT.md` omits `integration-tests/mcp-server` entirely

**File:** `DEVELOPMENT.md:32-35,92-97`
**Severity:** medium
**Kind:** missing documentation
**Issue:** The repo-structure diagram lists only `server`/`import` under `integration-tests/`; `integration-tests/mcp-server`, a real workspace with its own multi-file suite and ES-backed fixtures, isn't mentioned. The "Tests" section's integration-test instructions name only `integration-tests/server`'s `make start` + test-run sequence, even though `integration-tests/mcp-server` has the identical live-ES requirement. A developer following this doc as written sets up ES, runs one suite, and never learns the second one exists.
**Fix:** Add `mcp-server` to the repo-structure diagram's `integration-tests/` block, and add a line to the "Tests" section for `npm run test -w integration-tests/mcp-server`.
**Standalone:** yes.

---

## graphql-router

### Two ESLint errors, the first concrete diagnostics from the corrected `tsconfig.eslint.json`

**Files:** `modules/graphql-router/src/middleware/buildQuery/index.js:191`; `modules/graphql-router/src/utils/dataToExportFormat.js:346`
**Severity:** low for both, but for opposite reasons: one is a latent fragility that is correct today, the other is a false positive that should be suppressed rather than fixed. Neither is a live defect.
**Kind:** lint errors (the only two `error`-level findings in the four files linted so far; everything else was `warning`)
**Issue:** Surfaced by running `npx eslint` by hand on the files changed in the monorepo-review fix batch. Both are **pre-existing**, verified present at `HEAD` at identical positions before those changes, and neither was introduced by them. Both rules (`no-use-before-define`, `no-this-alias`) are syntactic rather than type-aware, so the corrected `extends` key did not surface them; they were always being reported and nobody was running the linter. This is the "expect real lint diagnostics on the first run" prediction from the `tsconfig.eslint.json` entry above, now with concrete instances.

**1. `opSwitch` used before defined (`no-use-before-define`).** Genuine mutual recursion: `getGroupFilter` (a hoisted `function` declaration) calls `opSwitch` at `:191`, and `opSwitch` (a `const` arrow at `:244`) calls `getGroupFilter` back twice. It works only because neither is invoked during module evaluation, so `opSwitch`'s temporal dead zone has passed by the time `getGroupFilter` runs. Correct today, fragile: any future top-level invocation, or a bundler or transform that eagerly evaluates, produces a `ReferenceError` rather than a compile error.

**2. `const outputStream = this` (`no-this-alias`).** Inside a `through2.obj(function (...) {...})` transform callback, where `through2` binds the stream to `this` as its documented API, and the alias is then passed as `pipe: outputStream`. The alias is necessary: converting the callback to an arrow function to satisfy the rule would lose the `this` binding and break the stream. This is the rule being wrong for this API, not the code being wrong.

**Fix:** For the first, change `opSwitch` from `const` to a `function` declaration so both halves of the mutual recursion are hoisting-safe in either direction. That removes the error without a suppression and without changing behaviour. For the second, add an inline `eslint-disable-next-line @typescript-eslint/no-this-alias` **with a comment naming `through2`'s `this` binding as the reason**; a bare suppression is worse than the warning, since the next reader cannot tell whether it was considered or silenced.

**Caveat on scoping the wider cleanup:** only four files have been linted. A full `npx eslint modules apps` run did not complete within two minutes, which is the separate `**/*.json` include problem noted in the `tsconfig.eslint.json` entry above, so the total backlog is unmeasured. Fix that include before treating any repo-wide lint count as known. Wiring lint into scripts and CI is already tracked as roadmap items 1.2 and 1.3, so this entry covers only the two findings, not the tooling gap.
**Standalone:** yes, both.

### Stale file reference in `buildCatalogueIntrospection.ts` comment

**File:** `modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts:3`
**Severity:** low (misleading comment only, no functional impact)
**Kind:** stale comment
**Issue:** The comment says this file is "verbatim from search-server/catalogDetails.ts", but that file no longer exists; the actual origin is `apps/search-server/src/introspection/serverDetails.ts`. Found while auditing `catalog`/`catalogue` spelling.
**Fix:** Update the comment to reference `serverDetails.ts`, or remove the provenance note if it no longer adds value.
**Standalone:** yes; one-line comment fix

### Sets query filter reads `INDEX` for both `index` and `type`

**File:** `modules/graphql-router/src/middleware/buildQuery/index.js:214-215`
**Severity:** medium (a Sets filter's ES `terms` lookup query likely targets the wrong document type)
**Kind:** bug
**Issue:** The `terms` filter built for a Sets-based query reads `sets[setsProperties.INDEX]` for both the `index` and `type` fields: `type: sets[setsProperties.INDEX]` should almost certainly read `sets[setsProperties.TYPE]`. Found while tracing `SetsConfigs` consumers to confirm making its `index`/`type` fields optional wouldn't introduce a new runtime risk; both fields are always populated by graphql-router's own fallback defaults regardless, so this bug predates and is unaffected by that change.
**Fix:** Change the second field to `type: sets[setsProperties.TYPE]`. Confirm via a test that a Sets-based query actually resolves against the configured `type`, not `index`, before treating this as fixed: the current behaviour may have gone unnoticed because both default to the same value (`'arranger-sets'`) in every existing deployment and test fixture.
**Standalone:** yes; one-line fix, but needs its own test coverage and verification against a real Sets deployment where index and type genuinely differ

### `buildAggregations` crashes when the SQON root is a leaf filter clause

**File:** `modules/graphql-router/src/middleware/buildAggregations/index.js:88`
**Severity:** medium (valid SQON rejected with an opaque error; hits and aggregations paths behave inconsistently)
**Kind:** bug
**Issue:** `(normalizedSqon?.content || []).filter(...)` assumes the SQON root is a combination node whose `content` is an array. A root-level leaf filter clause (e.g. `{ "op": "gt", "content": { "fieldName": "age", "value": 40 } }`) is valid per `SqonSchema` and is accepted by the hits query path, but in the aggregations path `content` is an object, so the query fails with the GraphQL error `((intermediate value) || []).filter is not a function`. Discovered via the MCP `execute_query` tool, which forwards SQONs verbatim: an LLM-supplied root-leaf SQON works for `queryType: "hits"` and errors for `"aggregations"`/`"both"`.
**Fix:** Normalize a root-level leaf by wrapping it in `{ op: 'and', content: [leaf] }` before (or inside) `buildAggregations`, matching the hits path's tolerance. The MCP query builder could defensively wrap root leaves too, but the canonical fix belongs in Arranger.
**Downstream workaround to delete when this is fixed (2026-08-10):** `build_sqon` now works around it. `normalizeRoot` in `apps/mcp-server/src/mcp/buildSqonTool.ts` wraps a root leaf in an `and` group on output, because `reduceSqon` unwraps single-item groups and a one-clause build would otherwise emit a bare leaf that works for `queryType: "hits"` and fails for `"aggregations"` and `"both"`. It carries a `TODO` pointing here. Delete it once `buildAggregations` handles a leaf root, and drop the corresponding assertions in `buildSqonTool.test.ts`. Until then, note that every SQON `build_sqon` emits is `and`-wrapped even for a single condition, which is why its `summary` and a hand-written equivalent SQON differ in shape while meaning the same thing.
**Standalone:** yes; small fix in `buildAggregations` plus a unit test for a root-leaf SQON. Removing the mcp-server workaround is a separate, optional follow-up: it stays correct either way.

### `GraphQLEndpointOptions` escape hatch

**File:** `modules/graphql-router/src/types.ts` (`GraphQLEndpointOptions`)
**Severity:** low
**Kind:** type-weakness
**Issue:** `& Record<string, unknown>` allows callers to pass arbitrary keys without type errors. Exists to accommodate undeclared options but defeats the purpose of the explicit type.
**Fix:** Enumerate all legitimate extra options explicitly, then remove `& Record<string, unknown>`.
**Standalone:** yes; purely additive type change, no runtime impact

### Apollo Server 3 is EOL: replace, don't upgrade

**File:** `modules/graphql-router/src/graphqlRoutes.ts` (`createEndpoint`)
**Severity:** medium
**Kind:** design-smell
**Issue:** Apollo Server 3 is end-of-life. Several type errors in this file trace back to AS3 type definitions: `con` not on `ExpressContext` (line ~259), `IRouter` vs `Application` mismatch in `applyMiddleware` calls (lines ~269, ~289), and the `context` API shape. The file itself has a TODO at line 1 noting the upgrade is pending.
**Fix:** The direction is to replace Apollo entirely, not upgrade to v4; see [GraphQL server migration](roadmap.md#graphql-server-migration-away-from-apollo) in the roadmap. graphql-yoga is the leading candidate. Upgrading to AS4 would be investing in a library the project intends to leave.
**Standalone:** no; part of the broader GraphQL server migration in the roadmap

### Duplicated server instantiation (main + mock)

**File:** `modules/graphql-router/src/graphqlRoutes.ts` (`createEndpoint`)
**Severity:** low
**Kind:** design-smell
**Issue:** Main and mock server instances are created with near-identical code blocks. A `// TODO: D.R.Y this thing!` comment acknowledges it.
**Fix:** Will be a natural cleanup opportunity during the Apollo to graphql-yoga migration, when `createEndpoint` gets rewritten anyway. Not worth fixing in isolation against code that's slated for replacement.
**Standalone:** no; better addressed as part of the GraphQL server migration

### `buildContext` connection parameter is vestigial

**File:** `modules/graphql-router/src/graphqlRoutes.ts` (`createEndpoint` > `buildContext`)
**Severity:** low
**Kind:** design-smell
**Issue:** The context builder receives a `connection` argument (`{ req, res, connection }`) whose type and origin are explicitly noted as unclear in a TODO comment. This is an Apollo Server artifact; `connection` exists in Apollo's context API for WebSocket subscriptions. Arranger doesn't use subscriptions, so the parameter is vestigial and the type is unresolvable against Apollo 3's definitions.
**Fix:** This will resolve naturally when Apollo is replaced (see [roadmap](roadmap.md#graphql-server-migration-away-from-apollo)). No need to fix in isolation.
**Standalone:** no; tied to the Apollo migration in the roadmap

### Error responses surfacing stack traces

**File:** `modules/graphql-router/src/graphqlRoutes.ts` (error handling / Apollo error formatter)
**Severity:** high (OWASP A09: Security Logging and Alerting Failures, A02: Security Misconfiguration)
**Kind:** security bug
**Issue:** Server error responses are including stack traces visible to API clients. Stack traces leak internal file paths, library versions, and implementation details that assist attackers. They should only appear in server logs, never in API responses.
**Fix:** Strip stack traces from client-facing error responses in the GraphQL error formatter. Optionally surface them when `enableDebug` is true (server-side only) or when `enableAdmin` is active; but that dependency on the Admin model is TBD. Safe default: never send stacks to clients.
**Standalone:** mostly yes; the stack stripping is a one-file fix. The question of whether debug mode re-enables stack visibility is the only part that touches the Admin design.

### `hasValidConfig` GraphQL resolver should be deprecated

**File:** `modules/graphql-router/src/schema/Root.ts` (`hasValidConfig` resolver)
**Severity:** low
**Kind:** design-smell
**Issue:** `hasValidConfig(documentType, index)` is a 2.x legacy query that validates a catalogue by matching an ES index name against registered aliases. The 3.x equivalent is `GET /introspection`, which identifies catalogues by `documentType` without coupling the frontend to ES index names. `hasValidConfig` is still present and still functional, but it encourages the wrong integration pattern and creates a maintenance surface as the schema evolves.
**Fix:** Formally mark `hasValidConfig` as deprecated in the schema (add `@deprecated` directive with migration note pointing to `GET /introspection`). Schedule removal for a future major release. Migration guidance for consumers is documented in [docs/migration/v3.1.md](../docs/migration/v3.1.md#replace-hasvalidconfig-with-the-introspection-api).
**Standalone:** yes; adding a `@deprecated` directive is a non-breaking additive change

### Download route body is brittle

**File:** `modules/graphql-router/src/download/index.js` (the `download` router)
**Severity:** medium
**Kind:** design-smell / reliability
**Issue:** The download route has several fragile points in how it receives and parses its request body:

1. `params` arrives as a JSON-stringified string inside a `urlencoded` form body (`JSON.parse(params)` on line 110). Double-encoding is easy to get wrong on the caller side and produces opaque parse errors with no indication of which layer failed.
2. Callers must pass full column descriptor objects (`fieldName`, `accessor`, `Header`, `extendedType`, `extendedDisplayValues`, `show`, `sortable`, `query`, `jsonPath`, plus UI-only fields like `minWidth` and `canChangeShow`). The router already holds the extended mapping at request time; everything except `fieldName` is derivable from it. Callers should only need to pass `fieldNames: string[]`, with optional per-field overrides. `dataToExportFormat.js` already partially reads from `extendedFieldsDict` for display names; the full resolution just never got wired up.
3. No validation of the parsed `params` object: missing or malformed `files`, unknown `fileType`, invalid `sqon`, and negative `maxRows` all pass through silently until they cause an error deep in `getAllData` or `dataToExportFormat`.
4. The `400` error response on catch returns `err?.message || err?.details || 'An unknown error occurred.'`; callers cannot distinguish a parse failure from a stream error from a missing-files error.
5. The `Content-disposition` header is set without quoting the filename (`attachment; filename=${responseFileName}`); filenames with spaces or special characters break the header.
   **Fix:** Accept JSON directly (`application/json` body) instead of URL-encoded form data with a double-encoded `params` field. Change the `columns` param to `fieldNames: string[]` and resolve the full descriptor internally from the catalogue's extended mapping (already available in the request context), with optional per-field overrides for display name and JSON path. Validate the body with Zod before streaming. Return structured error responses. Quote the filename in `Content-Disposition`. This is a breaking change for existing callers; coordinate with a minor version bump and document in the migration guide.
   **Standalone:** no; callers (including `arranger-components` download UI and any custom integrations) must update their request format in the same pass

### `fetchMapping` uses `cat.aliases` instead of `indices.getAlias`

**File:** `modules/graphql-router/src/searchClient/fetchMapping.ts` (`getESAliases`)
**Severity:** low (over-privileged; requires `*` index permission for alias lookup)
**Kind:** privilege minimization
**Issue:** `getESAliases` calls `esClient.cat.aliases({ format: 'json' })` with no index filter, retrieving ALL cluster aliases and doing client-side filtering. `GET /_cat/aliases` evaluates `indices:admin/aliases/get` as an index-level permission (OpenSearch `manage_aliases` group is `type: "index"` in the static plugin config) against all indices; the permission must be granted on `*` because the request is unscoped. A targeted `indices.getAlias({ index: esIndex })` call makes a scoped request, so the permission need only be granted on the data index pattern.
**Fix:** Replace `esClient.cat.aliases()` + `checkESAlias` with `esClient.indices.getAlias({ index: esIndex })`. If the alias exists, the response contains the backing index name; if not, handle the 404. The `indices:admin/aliases/get` permission on `*` can then be removed from the role and scoped down to the data index pattern.
**Standalone:** yes; confined to `fetchMapping.ts`; update `docs/setup.md` and `.dev/docs/search-engine-integration.md` permission tables when done

### No unit tests for `getESAliases` alias resolution

**File:** `modules/graphql-router/src/searchClient/fetchMapping.ts` (`getESAliases`)
**Severity:** low (missing test coverage)
**Kind:** missing test coverage
**Issue:** `getESAliases` has two distinct code paths: alias found (returns the backing index name) and no match (returns `esIndex` as-is); neither has a unit test. Mock the `cat.aliases` response to cover both branches.
**Standalone:** yes; unit test only, no application changes

### No unit tests for `resolveSetsInSqon` set expansion

**File:** `modules/graphql-router/src/mapping/hackyTemporaryEsSetResolution.js`
**Severity:** low (missing test coverage)
**Kind:** missing test coverage
**Issue:** `resolveSetsInSqon` has two paths: SQON contains no `set_id:` values (no-op, returns SQON unchanged) and SQON contains `set_id:` values (expands to stored IDs via an ES search). Neither path has a unit test.
**Standalone:** yes; but note the file also carries the `hackyTemporaryEsSetResolution` tech-debt entry; evaluate for removal during Sets full-feature implementation rather than investing deeply in tests for code that may be replaced

### No unit tests for `dataToExportFormat`

**File:** `modules/graphql-router/src/utils/dataToExportFormat.js`
**Severity:** medium
**Kind:** missing test coverage
**Issue:** `dataToExportFormat` transforms ES hit data into the export column format, handling `extendedDisplayValues` label substitution, `jsonPath` extraction, column visibility, and hit flattening. No unit tests exist.
**Fix:** Unit tests covering: basic field mapping; `jsonPath` extraction; `extendedDisplayValues` label substitution; columns with `show: false` excluded; empty hit set returns empty array.
**Standalone:** yes; pure transformation function

### `hackyTemporaryEsSetResolution.js`: stale ES 6.2 workaround + convention violation

**File:** `modules/graphql-router/src/mapping/hackyTemporaryEsSetResolution.js`
**Severity:** low
**Kind:** stale code / convention violation
**Issue:** Two related problems in one file. (1) The file header says the code is a workaround for an Elasticsearch 6.2 bug fixed in 6.3: "Once the issue is resolved by Elasticsearch in version 6.3, we no longer need these functions here." That condition was met years ago; we are on ES 7.x/OpenSearch. The function should be evaluated for removal. (2) `resolveSetIdsFromEs` reads `fallbackConfigs.sets.index` from a module-level import of the global `fallbackConfigs` object rather than receiving the sets index name as a parameter. This violates the module convention (modules receive config as typed params; they do not read from global or environment state).
**Fix:** ~~Verify whether `resolveSetsInSqon` and the `set_id:` expansion path are still exercised~~ Confirmed: `resolveSetsInSqon` is called unconditionally from `mapping/resolveAggregations.ts:96` on every request, regardless of `enableSets`; it is not gated and cannot be removed without breaking `set_id:` filter resolution wherever Sets is enabled. Rewrite `resolveSetIdsFromEs` to accept `setsIndex` as an explicit parameter rather than reading from `fallbackConfigs`. The ES 6.2 workaround framing in the file header is still stale and should be removed once confirmed unnecessary against current ES/OS versions, but the functions themselves stay. See also the new access-control entry below, found while confirming this.
**Standalone:** no; evaluate alongside the Sets full feature implementation; the `fallbackConfigs` parameter fix is standalone, the ES 6.2 header cleanup is standalone, but do not remove the file

### `ENABLE_SETS` flag does not fully gate the Sets query path

**File:** `modules/graphql-router/src/mapping/hackyTemporaryEsSetResolution.js` (`resolveSetsInSqon`, called unconditionally from `mapping/resolveAggregations.ts:96`); `modules/graphql-router/src/middleware/buildQuery/index.js:214-259` (`set_id:` terms-lookup query construction)
**Severity:** medium (OWASP A01: Broken Access Control; the risk is bounded by `setId` being an unguessable UUID, but there is no ownership check at all)
**Kind:** design gap / feature flag does not cover its own attack surface
**Issue:** `ENABLE_SETS` (default `false`) only gates `initializeSets`, which creates the sets ES index on startup (`config/utils/index.ts:15-17`). `resolveSetsInSqon` and the `set_id:` terms-lookup query builder run unconditionally on every request regardless of the flag. If a sets index exists in the cluster (the flag was enabled at some point, or the index is shared across deployments), any query containing `set_id:<uuid>` resolves to that set's full document ID list with no ownership check: the sets ES mapping stores `userId` per set, but nothing anywhere reads or enforces it.
**Fix:** Short-term mitigation: gate `resolveSetsInSqon` and the `set_id:` query path on `enableSets` explicitly, so a disabled flag is a real kill switch rather than only skipping index creation. Real fix: implement the ABAC ownership check already scoped in [roadmap: Sets full feature implementation](roadmap.md#sets-full-feature-implementation) before treating any `set_id:` query as safe in a multi-tenant deployment.
**Standalone:** yes for the flag-gating mitigation; no for the ABAC ownership check, which is the roadmap item's own scope

### `SupportedClientTypes`/`clientType` naming conflates "which search engine" with "which client library"

**File:** `modules/graphql-router/src/searchClient/types.ts` (`SupportedClientTypes`, `SearchConfig.clientType`, `SearchConfigWithClient.clientType`), exported publicly from `modules/graphql-router/src/index.ts`; compare `modules/types/src/configs/index.ts:161` (`SearchEngineType = 'elasticsearch' | 'opensearch'`) and `configOptionalProperties.SEARCH_ENGINE: 'searchEngine'`
**Severity:** low (naming/API clarity, no functional impact)
**Kind:** naming inconsistency
**Issue:** `modules/types` already names the consumer-facing concept correctly: an operator sets `searchEngine`, typed `SearchEngineType`, to say which search engine ('elasticsearch' | 'opensearch') a catalogue targets. `modules/graphql-router`'s `searchClient` module defines a second, separately-declared union over the exact same two values, `SupportedClientTypes` (`keyof SupportedClients`), used for `SearchConfig.clientType`/`SearchConfigWithClient.clientType` and exported publicly. "Client" is the correct word for the actual client library instances (`SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient }` legitimately stays "Client"-named, since it's a lookup table of real client objects), but the _selection_ type, the thing a caller of `buildSearchClient` sets to say which engine they want, reads as though it's choosing a client implementation detail rather than a search engine. This is what an earlier version of this entry (mistakenly removed as "resolved" after a since-merged PR fixed only a literal naming regression) was trying to flag: not that `SupportedClientTypes` needs to disappear, but that the engine-selection surface should read as "engine," not "client."
**Fix:** Rename the selection-facing usages (`SearchConfig.clientType`/`SearchConfigWithClient.clientType`, and ideally `SupportedClientTypes` itself where it names _which engine to target_ rather than _which client instance exists_) toward `searchEngine`/`SearchEngineType` terminology, reusing `SearchEngineType` from `modules/types` directly instead of maintaining a second, independently-defined union of the same two values. Leave `SupportedClients` and any type describing actual client library instances/behaviour named around "Client": that framing is correct there. Be judicious per-identifier rather than doing a blanket find-replace, since both concepts legitimately coexist in this file.
**Standalone:** yes; naming-only change, but `SupportedClientTypes` is a public export of `@overture-stack/arranger-graphql-router`, so this is a breaking change for any consumer referencing it directly; coordinate with a version bump per current semver policy.

### Network aggregation merging assumes identical Arranger versions across nodes, with no check

**File:** `modules/graphql-router/src/network/index.ts` (`createSchemaFromNetworkConfig`)
**Severity:** medium (silent incompatibility; a version-mismatched remote node can produce wrong or malformed merged results with no signal)
**Kind:** missing validation
**Issue:** The module's own doc comment already flags that this functionality assumes Arranger instances are running identical versions, but nothing checks this assumption anywhere: not at config load, not at query time. A remote node running a different Arranger version could have differently-shaped aggregation types or a different response shape, and none of it would be detected before that node's data gets merged into `AggregationAccumulator`'s combined result.
**Fix:** Add a version check (e.g. surfaced via each node's own introspection/health response) at startup or per-query, and at least warn or flag when versions don't match. What to actually do about a mismatch (exclude the node? proceed with a warning? require an explicit compatibility override?) is a separate, harder design question for later; the immediate fix is only making the existing assumption checked instead of silent.
**Standalone:** yes for the check itself; the mismatch-handling policy is a separate follow-on decision

### Remote node response content is not validated

**File:** `modules/graphql-router/src/network/resolvers/aggregations.ts` (existing `// TODO: Response content is not validated` comment)
**Severity:** low-medium (may be lower-risk in a deployment with known, matched versions, but nothing currently enforces that precondition, see the version-check entry above)
**Kind:** missing validation
**Issue:** `aggregationPipeline` reads a remote node's response assuming it matches the shape of the GraphQL query that was sent (`response.data[documentName]`), with no runtime check. If a remote node returns something unexpected (a different Arranger version, a misconfigured catalogue, a proxy in front of it returning an error page as a 200), this fails however indexing into an unexpected shape happens to fail, not with a clear error.
**Fix:** Validate the response shape (a lightweight runtime check, not necessarily full schema validation) before feeding it into the accumulator; fail that one node with a clear `INVALID_DATA`-style status (matching the existing `CONNECTION_STATUS` pattern) rather than an unhandled shape mismatch. Worth doing even alongside the version check above, not instead of it: trust but verify, defensive validation here is cheap and catches cases version-checking alone wouldn't, a genuinely misconfigured node, or a proxy silently swallowing the real response.
**Standalone:** yes; self-contained validation added to the existing response-handling path

### `filterNodesByNodeId` has no tests

**File:** `modules/graphql-router/src/network/utils/nodeFilter.ts`
**Severity:** low
**Kind:** missing test coverage
**Issue:** `filterNodesByNodeId` is a pure function with no accompanying tests. Key cases to cover: empty `nodesFilter` returns all nodes; populated filter returns only matching nodes; nodes with `nodeId: undefined` are excluded when a filter is provided; unknown `nodeId` values in the filter produce an empty result.
**Standalone:** yes; isolated unit test, no application changes

### `resolveAggregation` cardinality accumulation has no tests

**File:** `modules/graphql-router/src/network/aggregations/AggregationAccumulator.ts` (`resolveAggregation`)
**Severity:** low
**Kind:** missing test coverage
**Issue:** Cardinality accumulation in `resolveAggregation` (summing `agg.cardinality` across nodes, with `undefined` passthrough) has no tests, nor did the pre-existing accumulation logic for `buckets` and `bucket_count`. Cases to cover: cardinality sums correctly across multiple nodes; a node with `cardinality: undefined` does not contribute to the sum; an empty aggregations list produces `cardinality: 0`.
**Standalone:** yes; unit tests only, no application changes

### No unit tests for `convertToSqon` or other `network/utils/` functions

**Files:** `modules/graphql-router/src/network/utils/sqon.ts`, `modules/graphql-router/src/network/utils/gql.ts`, `modules/graphql-router/src/network/utils/promise.ts`
**Severity:** medium
**Kind:** missing test coverage
**Issue:** `convertToSqon` is a pure function at a user-input boundary: it parses an unknown value and returns `Result<SqonNode, { INVALID_SQON: string }>`. Every incoming SQON passes through it, making it security-relevant, yet it has zero test coverage. The other two utils files (`gql.ts`, `promise.ts`) are also untested.
**Fix:** Unit tests for `convertToSqon` covering: valid SQON returns `success(SqonNode)`; invalid SQON (wrong shape, missing `op`) returns failure with `INVALID_SQON`; null/undefined input returns failure; JSON string input is accepted. Add tests for `gql.ts` and `promise.ts` once their exported surface is confirmed non-trivial.
**Standalone:** yes; pure functions, no mocking required

### No unit tests for network resolvers

**Files:** `modules/graphql-router/src/network/resolvers/` (aggregations.ts, fetch.ts, networkNode.ts, response.ts)
**Severity:** medium
**Kind:** missing test coverage
**Issue:** Most of the network resolver layer has no tests. This is the core async multi-node query execution path: aggregation response resolving, remote node data fetching, network node response building, and response transformation. Bugs here affect all multi-catalogue network searches silently. `query.ts` (`createRemoteNodeGQLQuery`) has co-located tests (`query.test.ts`) and is not part of this gap.
**Fix:** Unit tests with mocked network node responses. The pure transformation files (`response.ts`, `networkNode.ts`) can be tested directly. `fetch.ts` requires HTTP-level mocking (e.g. `undici MockAgent` or similar). Cover: single-node success; partial node failure (one down, others succeed); empty response; aggregation accumulation across nodes.
**Standalone:** partial; transformation functions are standalone; `fetch.ts` depends on establishing the HTTP mock pattern first

### Network aggregation schema discovery depends on GraphQL introspection being open on remote nodes

**File:** `modules/graphql-router/src/network/setup/query.ts` (`fetchNodeAggregations`)
**Severity:** medium
**Kind:** design coupling / security constraint
**Issue:** At startup, Arranger queries each remote node using `__type(name: $documentTypeName)` to discover its aggregation field types. `__type` is part of the GraphQL introspection system. If a remote node has `disableGraphQLIntrospection: true`, its schema discovery fails and the node is excluded from federation with a `NETWORK_ERROR` or `INVALID_DATA` result. This creates a conflict: hardening any node in a network aggregation deployment breaks the federation setup for nodes pointing at it. Side effect worth naming explicitly: this is a `graphql-router` design issue, but the fix lands in `apps/search-server`.
**Fix:** Replace the `__type`-based discovery with a call to the REST `/introspection/fields` (or `/introspection/:catalogueId`) endpoint already provided by `apps/search-server`. That endpoint returns equivalent field information without requiring GraphQL introspection to be open. Natural task within the GraphQL server migration; coordinate with the yoga switchover so both changes land together.
**Standalone:** no; the REST introspection endpoint must be stable and reachable from the aggregating node's network context; coordinate with the yoga migration

### `disableDownloads`/`DISABLE_DOWNLOADS` is fully documented and threaded through config, but never actually checked anywhere

**File:** `modules/graphql-router/src/router.ts:129-134`
**Severity:** high
**Kind:** security
**Issue:** `disableDownloads` is a first-class feature flag (`modules/types/src/configs/constants.ts`), read from the environment (`apps/search-server/src/configs/fromEnv/localEnvs.ts:39`) and documented as functional in both `modules/graphql-router/README.md:86` ("Disable the TSV/file download endpoint") and `docs/reference/07-feature-flags.md:33`. But `router.ts` mounts the download router unconditionally: `router.use('/download', downloadRoutes({ enableDebug }))`, confirmed directly, no reference to `disableDownloads`/`DISABLE_DOWNLOADS` anywhere in the file. Every sibling flag in the same feature-flag group is actually wired (`disableFilters` → `accessControl`, `disableGraphQLIntrospection`/`disablePlayground`/`enableGraphQLBatching` → `graphqlRoutes.ts`); this is the only one that isn't. Confirmed via repo-wide grep: `disableDownloads: true` never appears anywhere in the monorepo outside a false-only assertion in two integration-test files.
**Fix:** Gate the `/download` mount (or the router's own `POST /` handler) on the flag, returning 404/403 when set. Add a test (`disableDownloads.test.ts`) asserting the endpoint actually refuses when the flag is on, mirroring `disableFilters.test.ts`/`disablePlayground.test.ts`.
**Standalone:** yes.

### An empty grant set compiles to match-all, so a server-side filter meant to restrict everything restricts nothing

**File:** `modules/graphql-router/src/middleware/buildQuery/normalizeFilters.js:19-32` (`groupingOptimizer`); `buildQuery/index.js:184-203`; `mapping/utils/compileFilter.js:12-15`
**Severity:** high. **The single most important item for the Usher/ABAC work**, and live today for any `getServerSideFilter` consumer.
**Kind:** security (fail-open on the access-control seam)
**Issue:** The natural encoding of a grant-derived filter is `{op:'and'|'or', content: grants.map(...)}`. With an empty grant list, three of the four natural encodings restrict nothing, because a clause-less `bool` is match-all in Elasticsearch. Verified by execution:

```
and of no grants   -> {"bool":{"must":[]}}                            match all
or  of no grants   -> {"bool":{"must":[{"bool":{"should":[]}}]}}      match all
not of no grants   -> {"bool":{"must":[{"bool":{"must_not":[]}}]}}    match all
in with empty list -> {"bool":{"must":[{"terms":{"study":[],...}}]}}  the only fail-closed encoding
```

`groupingOptimizer` flattens the `and` case out of the tree entirely, so the emitted body is byte-identical to one with no server-side filter at all. Which way an empty grant set resolves therefore depends on which of two equally idiomatic encodings the filter author picked, with no signal either way.

Separately and compounding, `compileFilter` does `serverSideFilter || { op:'and', content: [] }`, so a callback returning `undefined`, `null`, `false`, `''`, or `0` also becomes no restriction. A `getServerSideFilter` written in the ordinary defensive style (`(ctx) => ctx.user?.grants && buildFilter(...)`) fails open for an unauthenticated or malformed context. Worth noting the contrast, which is what makes this the dangerous case: malformed filter *shapes* all throw and fail closed. Only the falsy and empty paths are silent.

**Framing corrected 2026-08-18 after the Usher session pushed back on an inference recorded here.** This entry originally said this is the scenario an Usher PEP hits constantly, listing an unauthenticated caller, grants not yet loaded, and a user entitled to nothing. That was an inference about Usher's model, not a verified fact about it, and it was wrong: all three resolve to *absence from the grants map*, which a PEP handles above filter composition with a 404 and which never produces a filter at all. The compilation finding above is unaffected, since it was verified by execution against Arranger and applies to any `getServerSideFilter` author.

What changes is why it is severe. Not "a PEP will routinely emit empty filters" but "the paths that must deny cannot be allowed to reach filter composition at all, because if one ever does, the result is full disclosure rather than an error." That makes it an argument for a structural separation rather than for defensive coding in the callback, and it applies equally to a hand-written filter with an early-return branch. It must fail closed.
**Fix:** Give the seam an explicit typed deny-all value compiling to `{"bool":{"must_not":{"match_all":{}}}}`, and have `compileFilter` reject a nullish or empty-group server-side filter rather than defaulting it, requiring callers to pass the allow-all sentinel (`getDefaultServerSideFilter`) when that is genuinely intended. Add a test asserting an empty grant set yields a match-none query, which no test currently does.
**Standalone:** yes, and it should land before any plugin work.

### `stringToBool` resolves every unrecognized value to the permissive side, so hardening flags silently fail to apply

**File:** `modules/types/src/tools/stringFns.ts:1-8`; consumed at `apps/search-server/src/configs/fromEnv/localEnvs.ts:39-49`
**Severity:** medium
**Kind:** security (fail-open configuration)
**Issue:** Read from source: the input is lowercased but never trimmed, and only `true` and `1` return true. For the entire `DISABLE_*` family, the *hardening* direction is therefore the one that silently fails:

```
DISABLE_X="yes"   -> false      DISABLE_X="on"     -> false
DISABLE_X="True " -> false      DISABLE_X=" true"  -> false
```

A single trailing space is trivially produced by a Helm templated value or a `.env` line. `DISABLE_FILTERS=yes` leaves filtering enabled; `DISABLE_GRAPHQL_INTROSPECTION=on` leaves introspection open. There is no warning at any level and the boot log offers no way to tell which way a flag resolved. `parseSearchEngine`, two lines away in the same file, already warns on an unrecognized value, so the correct pattern exists in the codebase and simply was not applied here.
**Fix:** Trim, accept the common truthy and falsy vocabularies, and warn on anything unrecognized. Given every consumer is a security flag, an unparseable value should resolve to the restrictive side, not the permissive one. Note the sibling `stringToNumber` has the analogous problem for limits: `MAX_RESULTS_WINDOW=5,000` parses as unparseable and falls back to the built-in 10000, *widening* a cap the operator was trying to tighten.
**Standalone:** yes.

### An empty or whitespace-only `ALLOWED_CORS_ORIGINS` silently yields wildcard CORS

**File:** `apps/search-server/src/server.ts:43`; parsing at `apps/search-server/src/configs/fromEnv/localEnvs.ts:30-32`
**Severity:** medium
**Kind:** security (fail-open configuration)
**Issue:** `cors(allowedCorsOrigins?.length ? { origin: allowedCorsOrigins } : undefined)`. The parse `.filter(Boolean)`s empty tokens away, so `""`, `" "`, `","`, and `" , "` all yield `[]`, whose length is 0, so `cors()` is called with no options and defaults to `Access-Control-Allow-Origin: *`. An empty string is exactly what a Helm chart emits for a templated-but-unset value, and a stray comma is what an operator produces while editing a list down to one entry. Verified against a live express app: all four inputs produced `ACAO: *`, while a real origin list produced no wildcard. Mitigating: `cors()` sets no `Access-Control-Allow-Credentials`, so cookie-authenticated requests are not exposed; token-in-header portals are.
**Fix:** Distinguish "unset" from "set but empty". If the variable is defined but parses to zero origins, warn and either fail startup or fall back to deny-all rather than the wildcard.
**Standalone:** yes.

### Aggregations on a server-side-filtered field escape the filter via an ES `global` wrapper, returning whole-index counts

**File:** `modules/graphql-router/src/middleware/buildAggregations/index.js:63-79` (`wrapWithFilters`), `:31-54` (`removeFieldFromQuery`); root cause `modules/graphql-router/src/mapping/utils/compileFilter.js:3-17`
**Severity:** high, and the most serious item found in the Phase 0 sweep. Live today, no plugin required.
**Kind:** security (access-control bypass, data disclosure)
**Issue:** With the default `aggregations_filter_themselves: false`, an aggregation on a field that the server-side filter restricts is wrapped in an ES `global` aggregation, which ignores the search query by definition, and the compensating `filter` sub-aggregation is rebuilt from the query with that field's clauses removed. When the field is the access-controlled one, the removed clause is the access-control clause. Verified by execution with a server-side filter of `access in ["public"]`, aggregating on `access`:

```
QUERY (correctly restricted): {"bool":{"must":[{"terms":{"access":["public"],"boost":0}}]}}
AGGS (escapes it):            {"access:global":{"global":{},"aggs":{"access":{"terms":{"field":"access","size":300000}}, ...}}}
```

The caller receives exact per-bucket counts for every access tier across the whole index. Amplifications, all verified: `top_hits(_source:["*"])` rides inside the escaped bucket and returns complete documents from outside the filter, making this a record-disclosure channel rather than counts-only; `filter_by_term(filter: <SQON>)` gives a count oracle for any caller-authored predicate over the unfiltered index; and `stats { min max }` on a numeric field returns a single real record's value from outside the filter. No prior knowledge is needed to find the restricted field: run each field's buckets with the flag true and false and diff.

**Root cause is structural, not a missing guard.** `compileFilter` merges the client and server SQONs into one before `buildQuery` compiles them, so by the time `removeFieldFromQuery` runs the two are indistinguishable. A mechanism intended to stop a facet filtering itself therefore strips access control with equal effect.
**Fix:** Keep client and server filters separate through to aggregation building: have `compileFilter` return both rather than one merged SQON, pass both into `buildAggregations`, and run `removeFieldFromQuery` only over the client's. `createGlobalAggregation` must then always re-apply the server filter beneath the `global`, never subject to field removal.

**Immediate stopgap, counter-intuitive and worth stating plainly:** `aggregations_filter_themselves: true` **closes** this; it returns early before any `global` wrapper is emitted. Verified: `aft=false -> global? true`, `aft=true -> global? false`. The flag's name invites the opposite assumption. A deployment handling sensitive data can force it server-side in `resolveAggregations` today, at the cost of facet completeness (selecting a facet value collapses that facet), which should be a deliberate tradeoff rather than a silent one.
**Standalone:** the stopgap yes, immediately. The real fix touches `compileFilter`'s contract and its three callers, so sequence it with the export-bypass and federation fixes as one change to the seam.
**See also:** [`.dev/docs/arranger-auth/phase-0-audit.md`](docs/arranger-auth/phase-0-audit.md) for the full amplification list and the bounds.

### No small-count suppression exists server-side, and cardinality ships at maximum precision

**File:** `modules/graphql-router/src/middleware/flattenAggregations.js:22-50`; `buildAggregations/createFieldAggregation.js:9` (`CARDINALITY_DEFAULT_PRECISION_THRESHOLD = 40000`)
**Severity:** medium (a live disclosure today, not a pending feature)
**Kind:** security (data disclosure)
**Issue:** The roadmap's "Aggregation privacy masking" item is genuinely unimplemented: a repo-wide grep for suppression/threshold/k-anonymity patterns across `graphql-router`, `types`, and `search-server` returns only `precision_threshold` and an unrelated slow-log threshold. The only suppression anywhere is `modules/charts`' client-side presentation, which is bypassed by querying the API directly. Exact `doc_count` including counts of 1, `bucket_count`, and `cardinality` are all returned raw.

Two corrections to the usual framing of this: a *low* `precision_threshold` makes cardinality *less* accurate, so the risk runs opposite to intuition; and Arranger's default of `40000` is Elasticsearch's documented **maximum**, so distinct counts are effectively exact up to 40k unless a caller lowers it deliberately. Combined with caller-controlled `histogram(interval: Float)` accepting arbitrarily fine intervals and `range()` accepting single-width probe ranges, this is re-identifying on the set the caller is *permitted* to see, independently of any filter bypass.
**Fix:** Implement in `flattenAggregations`, the single choke point every aggregation response passes through, with a per-catalogue `minAggregationCount`. Two cascades the roadmap's design questions do not currently capture: `stats.min`/`stats.max` disclose an individual value at *any* count and need suppressing or coarsening independently of a count threshold; and `cardinality` needs a configurable ceiling on `precision_threshold`, since exactness is the disclosive property.
**Standalone:** yes.

### The documented `getServerSideFilter` example uses `field` instead of `fieldName`, so it compiles to a filter that restricts nothing

**File:** `modules/graphql-router/README.md:206`
**Severity:** high (pending one check that may make it critical, see below)
**Kind:** security (documentation defect with a direct access-control consequence)
**Issue:** This README block is the only public documentation of Arranger's only built-in access-control mechanism. Its worked example writes the SQON content clause as `{ op: 'in', content: { field: 'acl', value: [String(userId)] } }`. SQON content clauses use `fieldName`; `field` is not a recognized key. `buildQuery` does not reject it, it emits a null clause. Verified by executing both spellings through the real `buildQuery`:

```
README example (field:)   -> {"bool":{"must":[null]}}
correct     (fieldName:)  -> {"bool":{"must":[{"terms":{"acl":["user-1"],"boost":0}}]}}
```

So an operator who followed the documentation has an access-control filter that restricts nothing, and gets no error saying so. Independent of Usher and of federation. Grep confirms this is the only occurrence; `docs/federated-search.md` and the SQON reference use the correct key.

**Open sub-question that decides the final severity:** what a live ES/OS cluster does with `{"bool":{"must":[null]}}`. If the cluster rejects the body, the query fails closed and the operator notices immediately; if it ignores the null entry, the filter is silently absent and this is a silent total bypass. One query against the integration-test cluster settles it. Rated high pending that check rather than critical, deliberately, so the rating is not overstated before it is known.
**Fix:** Correct the README to `fieldName`. Separately, and more durably, make `compileFilter` or `buildQuery` reject a server-side filter that compiles to a null clause: a filter silently compiling to nothing is the worst available failure mode for this specific callback, and a loud rejection is strictly better than a permissive default here.
**Standalone:** yes, the README fix. The null-clause rejection is small but is a behaviour change worth its own test.

### Federated queries never compose the server-side filter, so federation bypasses access control

**File:** `modules/graphql-router/src/network/resolvers/index.ts:99-100`; `network/resolvers/query.ts:77-89`; `network/resolvers/aggregations.ts:70-85`; omission site `graphqlRoutes.ts:388,473`
**Severity:** high. **Blocking for Usher**, and live today for any deployment that both federates and relies on `getServerSideFilter`.
**Kind:** security (access-control bypass)
**Issue:** `queryVariables` is built by spreading the GraphQL args and deleting only `nodesFilter`, so the SQON sent to a remote node is byte-for-byte the client's. There is no `compileFilter` step anywhere in the subsystem. Confirmed mechanically: `grep -rn "getServerSideFilter" modules/graphql-router/src/network/` returns **0** hits, against 38 elsewhere in the package. Verified by execution against a fake remote, with a filter of `access_level in [public]`: the local ES body carried the restriction, the outgoing remote request carried only the client's clause, and the remote's restricted bucket appeared in the merged result. `nodesFilter` compounds it: naming only remote nodes drops the local node from the pipeline, and `getServerSideFilter` is then invoked zero times for the whole request.

Two structural aspects matter more than the bug itself. First, `getServerSideFilter` is already in lexical scope at `graphqlRoutes.ts:473` where the network schema is built, and simply is not passed, with no type error and no test to catch it. Second, remote responses are merged into `AggregationAccumulator` with no validation and no per-node attribution, so after merge no bucket can be traced to the node that produced it, and a misconfigured or compromised remote can inject bucket keys and inflate counts that the local node presents as its own.

Bound on impact: federation returns counts and bucket keys only, never documents, so this is aggregate-level disclosure from remote nodes rather than record disclosure, and the local node's own restricted records are unaffected. The local federated branch is correctly filtered (it reuses the already-bound resolvers), so the problem is asymmetry: one response mixes enforced and unenforced contributions in shared buckets with nothing marking which is which.
**Fix:** Thread `getServerSideFilter` into `createSchemaFromNetworkConfig`/`aggregationPipeline` and compose it into `queryVariables.filters` before the remote query is built. Then make omission structurally impossible by having the network query builders require a resolved filter rather than accept an optional one, the same fix the export bypass needs; land them as one change to the seam rather than two patches. Note this is defence in depth only: a remote node can ignore the SQON it receives, so it must not be the sole control. Also warn at boot when `network.remoteNodes` is non-empty and no passthrough header is configured, since the default posture (no identity forwarded) plus the documented `if (!userId) return null` pattern is fail-open on both ends.
**Standalone:** no; sequence with the export-bypass fix, since both are the same seam.
**See also:** [`.dev/docs/arranger-auth/phase-0-audit.md`](docs/arranger-auth/phase-0-audit.md) for the executed evidence, and the related reporting defect where a node dropped at query-construction time is reported as `status: "OK", hits: 0` rather than as errored.

### The download/export path never composes the server-side filter, bypassing Arranger's only access-control mechanism

**File:** `modules/graphql-router/src/utils/getAllData.js:51-53`; contrast `mapping/resolveHits.js:271`, `mapping/resolveAggregations.ts:99`, `mapping/resolveSets.js:79`
**Severity:** high. **Blocking for the Usher/ABAC work**, and exploitable today without any plugin.
**Kind:** security (access-control bypass)
**Issue:** `getServerSideFilter` is Arranger's only built-in access-control mechanism: a per-request callback returning SQON that is merged with the client's filters. Confirmed by grep that three of the four read paths compose it via `compileFilter({ clientSideFilter, serverSideFilter })`, and the export path does not. `getAllData.js` calls `buildQuery({ filters: sqon })` with the client's SQON raw; `getServerSideFilter` is never invoked anywhere under `download/` or in `getAllData.js`.

| Read path | Composes the server-side filter? |
|---|---|
| Records (`hits`) | yes |
| Aggregations / facets | yes |
| Sets | yes |
| **Download / export** | **no** |

So any deployment relying on `getServerSideFilter` for record-level access control (the documented purpose, and the mechanism the Usher PEP plugin would naturally build on) can have that control bypassed by exporting instead of querying. Compounding: `disableFilters` also does not cover `/download` (entry above), so the export route bypasses *both* mechanisms; and `/download` has zero tests at any layer with its formatter tests silently skipped, so nothing would have caught either.
**Fix:** Route the export path through the same `compileFilter` composition as the three resolvers. Then make omission structurally impossible rather than a matter of remembering: have `buildQuery`/`buildAggregations` require the resolved filter (or accept the context and resolve it themselves), so a newly-added read path cannot repeat this. Add a test asserting an export honours a non-null `getServerSideFilter`; note no existing test anywhere passes a filter that actually filters, every call site passes `() => null`.
**Standalone:** yes for the composition fix, and it should not wait for the Usher work. See [`.dev/docs/arranger-auth/`](docs/arranger-auth/index.md) for how this fits the enforcement-seam design.

### `disableFilters` protects `/graphql` but not `/download`; a deployment disabling arbitrary filters can still get a fully-filtered export

**File:** `modules/graphql-router/src/accessControl/disableFilters.ts:27-46`; `modules/graphql-router/src/download/index.js:106-110`
**Severity:** high
**Kind:** security
**Issue:** `enforceAccessControl` runs `rejectSqonWhenFiltersDisabled` for every request when `disableFilters` is on, but `getVariablesFromRequest` only inspects `req.body.variables`/`req.query.variables`, the GraphQL wire shape. Confirmed directly: the download route parses its filter from a completely different location, `const { params } = req.body; ...JSON.parse(params)`, and that parsed object's `sqon` flows straight into `getAllData` to build the ES query for the export, never touching `getVariablesFromRequest` at all. A deployment that sets `disableFilters: true`, presumably to prevent arbitrary user-specified query criteria, still allows a fully filtered CSV/TSV export via `/download`.
**Fix:** Either have `download/index.js` reject requests carrying a non-empty `sqon` when `disableFilters` is set, or extend the access-control middleware to also inspect `req.body.params` (after JSON-parsing) for the download route. Needs a test analogous to `disableFilters.test.ts` but exercising the download path.
**Standalone:** yes; should land together with the `disableDownloads` fix above since both touch the same route's gating logic.

### TSV/JSON export has no CSV/formula-injection or delimiter-escaping protection

**File:** `modules/graphql-router/src/utils/dataToExportFormat.js:146-155` (`rowToTSV`), `166-188` (`columnsToHeader`)
**Severity:** medium-high
**Kind:** security
**Issue:** `rowToTSV` joins raw ES field values with a hardcoded tab, no escaping of any kind. Two distinct problems: (1) **CSV/Formula injection (CWE-1236):** a field value beginning with `=`, `+`, `-`, or `@` is written into the export unmodified; opening the resulting file in Excel/Sheets can execute a formula (including data-exfiltration formulas like `HYPERLINK`/`WEBSERVICE`) if any indexed free-text field (clinical notes, sample descriptions) can be influenced by a data submitter. (2) **Data integrity:** a value containing a literal tab or newline is not quoted or stripped, silently shifting columns for that row. The planned `saveCSV` roadmap item scopes RFC 4180 comma/quote/newline escaping for a *future* `csv` format, but doesn't address formula-prefix neutralization, a distinct concern, and doesn't fix today's TSV path either way.
**Fix:** Neutralize formula-triggering leading characters (prefix with a single quote, or otherwise ensure spreadsheet software won't interpret the value as a formula) in both the current TSV path and the planned CSV path, and escape/strip embedded tabs and newlines in `rowToTSV`. Worth doing in the same pass as the `saveCSV` work, since new escaping code is being written there anyway, but the TSV gap is a today problem, not contingent on that work.
**Standalone:** yes for the TSV half; the CSV half naturally lands alongside the `saveCSV` roadmap item.

### `modules/graphql-router/src/admin/` is a fully disconnected legacy admin backend, still compiled into the published package, with no access control of its own

**File:** `modules/graphql-router/src/admin/**` (~30 files: `index.ts`, `resolvers.ts`, `schemaTypeDefs.ts`, `schemas/{ProjectSchema,IndexSchema,AggsState,ColumnsState,ExtendedMapping,MatchboxState}/*`, `services/elasticsearch/index.ts`)
**Severity:** medium
**Kind:** dead-code / security-adjacent
**Issue:** A complete, self-contained ApolloServer v3 instance, using the old `graphql-tools` `mergeSchemas`/`makeExecutableSchema` and its own direct `@elastic/elasticsearch` client (independent of the module's own `searchClient` abstraction), auto-creating an `ARRANGER_PROJECT_INDEX` on `initialize()` if missing. It implements `newProject`/`deleteProject` mutations that write straight to Elasticsearch with no auth/authz check anywhere in the request context. This is the literal backend for the ES-config-mutation design the roadmap already calls a design mistake (see "Admin UI replacement"); it isn't gone, it's dormant. Confirmed unreachable today: not exported from `src/index.ts`, not imported by `router.ts`/`graphqlRoutes.ts` anywhere in the repo, and not in the package's `exports` map (only `.`, `./utils`, `./download` are exposed, confirmed directly against `package.json`). Despite that, it **is** compiled into `dist/admin/` and ships in the published tarball. Root cause: `tsconfig.json:97` already tries to exclude `src/admin/*`, but `tsconfig.release.json` (the config the real `build` script actually uses) defines its own `exclude` array that doesn't mention `admin` at all, `extends` does not merge array-valued options, the child's `exclude` fully replaces the parent's, so the exclusion never applies to the real build; even taken at face value, `"src/admin/*"` (single `*`) wouldn't have excluded nested files like `schemas/AggsState/index.ts` anyway. A live, real, current-monorepo dependency (`"graphql-tools": "^9.0.34"` in `package.json`) exists solely to support this dead subtree, confirmed by grep, every import of the old unscoped `graphql-tools` package (as opposed to the correctly-used scoped `@graphql-tools/*` packages) is under `src/admin/**`, nothing live uses it. This is distinct from the already-documented `modules/admin-ui`/`integration-tests/admin` deprecation (a separate frontend and its tests) and from the `enableAdmin` flag (gates unrelated behaviour in `schema/index.ts`/`createConnectionResolvers.ts`, never touches this directory). Confirmed a second, independent way this is truly abandoned, not just unused: `integration-tests/admin/test/index.test.js` imports `adminGraphql` from this package's `dist`, a symbol that doesn't exist and never did in the current `src/index.ts`; that suite would fail at import time if ever re-enabled. Git history shows exactly one commit ever touching `src/admin/` (`0a56b9c6`, "abstract server and types from main Arranger module"), consistent with code moved during a module split and never rewired.
**Fix:** Confirm with the team whether this was intentionally kept for a future revival; if not, delete `src/admin/**` entirely (it implements the design being replaced, not anything to build on) and remove the now-unnecessary `graphql-tools` dependency. If somehow revived, note it has no access control of its own today.
**Standalone:** yes, the deletion is self-contained; if kept, fixing `tsconfig.release.json`'s `exclude` array (add `"src/admin/**"`) is the minimum interim mitigation to stop it shipping in `dist/`.

### `buildAggregations`'s `startsWith(nestedPaths)` is dead code at depth 2+, and two overlapping nested-filter mechanisms have never been reconciled

**File:** `modules/graphql-router/src/middleware/buildAggregations/index.js:96-100` (`contentsFiltered`), feeding `createFieldAggregation.js:95-105` (`:nested_filtered`); overlapping mechanism in `buildAggregations/injectNestedFiltersToAggs.js` (`:filtered`)
**Severity:** medium. **URGENT for the Usher/ABAC work** (see below), low urgency otherwise.
**Kind:** dead code + unreconciled design overlap
**Issue:** `c.content?.fieldName?.startsWith(nestedPaths)` passes an *array* to `startsWith`, which coerces it via `Array.prototype.join(',')`. Confirmed by execution, the behaviour is depth-dependent:

| nesting depth | coerces to | effect |
|---|---|---|
| 0 (flat field) | `''` | always true, but `isNested` is falsy so `termFilters` is computed and never used. Harmless. |
| 1 | `'participants'` | correct, **by coincidence**: a single-element array stringifies to exactly its element |
| 2+ | `'participants,participants.diagnoses'` | never matches a real field name, so `termFilters` is always empty and the `:nested_filtered` wrapper is never built |

**Corrected severity, and this is the important part.** An earlier version of this entry claimed the depth-2 case silently drops nested-filter exclusion, implying wrong aggregation counts. That is **not** what happens, verified directly: `injectNestedFiltersToAggs` independently applies the same nested SQON filters via a `<path>:filtered` wrapper, and it works correctly at depth 2+. So counts are right today; the `startsWith` expression is simply dead at the depth where it would matter.

**Why the obvious fix is not safe, confirmed empirically rather than argued.** Replacing the expression with `nestedPaths.some((path) => fieldName?.startsWith(path))` was applied and tested: the `buildAggregations` suite went from 10/10 to 7/10, failing exactly tests 6, 7, and 8, the three depth-2 sibling-filter cases. Dumping the real output shows why: both wrappers now fire, nested one inside the other, applying the same field filter twice. That alone would be merely redundant, but the two mechanisms do not use the same boolean semantics:

- `injectNestedFiltersToAggs` builds `bool.should` (OR across sibling filters)
- `createFieldAggregation`'s `:nested_filtered` builds `bool.must` (AND across sibling filters)

With exactly one sibling filter those are equivalent, which is why the naive fix looks harmless on the existing fixtures. With two or more sibling filters they are not, so "fixing" the coercion silently changes query semantics from OR to AND-on-top-of-OR for multi-filter depth-2 aggregations. That is a behavioural change to filtered aggregation counts, not a typo repair.
**Fix:** Needs a design decision before any code change: which mechanism owns nested-filter application at depth 2+, and is `should` or `must` the intended semantics for multiple sibling filters on the same nested path? Most likely one of the two paths should be deleted outright rather than both being made to work. Whichever is kept needs a test with **two** sibling filters on the same nested path, which no current fixture has; every existing depth-2 test uses exactly one, which is precisely why the overlap went unnoticed.
**Standalone:** no. Confirmed unsafe as a drop-in change; the empirical result above is the evidence, not a caution.

**Why this is urgent specifically for Usher/ABAC:** the usher-arranger PEP plugin translates Usher grants into server-side SQON filters, and its correctness guarantee is that a grant-derived filter is actually applied to both records *and* aggregate counts. That guarantee runs straight through this code. Two overlapping mechanisms with different boolean semantics, one of them dead at the depth real clinical schemas use, is not a foundation to build access control on: an access-control filter that becomes OR where AND was intended is an over-disclosure. Reconcile this before the plugin's filter-injection point is designed, not after. See [`.dev/docs/usher-plugin.md`](docs/usher-plugin.md) and roadmap § Auth and field/record-level access control.

### Legacy wildcard-in-`IN` filter only converts the first `*` to a regex wildcard

**File:** `modules/graphql-router/src/middleware/buildQuery/index.js:57-73` (`getRegexFilter`)
**Severity:** medium
**Kind:** bug
**Issue:** When an `in`/`not-in` value contains a literal `*`, `getRegexFilter` builds an ES `regexp` query via `value.replace('*', '.*')`. `String.prototype.replace` with a string pattern replaces only the first occurrence: `'foo*bar*baz'.replace('*', '.*')` → `'foo.*bar*baz'`, confirmed directly, the second `*` is left as a literal regex quantifier in ES/OS `regexp` syntax ("zero or more of the preceding character"), silently changing query semantics for any value with more than one wildcard. Distinct from the newer, correctly-implemented `WILDCARD_OP`/`getWildcardFilter` path, which uses ES's native `wildcard` query type and needs no conversion. All existing tests in `buildQuery/__tests__/buildQueryWildcard.test.js` use values with exactly one `*`, untested and unnoticed.
**Fix:** Use `value.replace(/\*/g, '.*')` and add a test case with multiple `*` in one value.
**Standalone:** yes.

### `saveSet` performs no structured logging on a sensitive, persistent write

**File:** `modules/graphql-router/src/mapping/resolveSets.js:66-119`
**Severity:** medium
**Kind:** security (OWASP A09)
**Issue:** `saveSet` creates a new persistent, UUID-identified resource carrying a client-supplied `userId`, the full resolved document-ID list, and the originating `sqon`, exactly the kind of ownership-bearing, audit-relevant action this repo's own logging convention calls out. No `console.log`/`console.warn`/structured event of any kind exists anywhere in this function. Separate from the already-tracked `ENABLE_SETS`/ownership-check gap and from the "Sets: full feature implementation" roadmap item (neither mentions logging), and narrower than the "Structured request logging as a prerequisite for ABAC" roadmap item (scopes per-query-request logging for `hits`/`aggregations`, not this mutation).
**Fix:** Add a structured log entry on set creation (`{ event: 'set_created', setId, userId, type, size, catalogue }` at minimum), independent of and ahead of the ABAC ownership work, so there's at least a trail of who created what before enforcement exists.
**Standalone:** yes.

### Download endpoint accepts an unauthenticated `mock` flag that corrupts export pagination

**File:** `modules/graphql-router/src/download/index.js:69-70`; `modules/graphql-router/src/utils/getAllData.js:59-69`
**Severity:** low-medium
**Kind:** bug
**Issue:** `dataStream` destructures `mock` directly from the client-supplied, JSON-parsed `params` body with no gating on `enableDebug`/`enableAdmin`. `mock` then selects `schema: mock ? mockSchema : schema` for the initial `runQuery` call used solely to compute `hitsCount`/`total`/pagination steps, but the actual per-page data fetch always uses the real `esClient.search` regardless of `mock`. Any caller of the public `/download` endpoint can force the total-hit-count estimate to come from GraphQL's auto-mock resolvers instead of the real index, corrupting the computed page count with no benefit to a legitimate caller. A concrete instance the existing "Download route body is brittle" entry's five numbered issues don't name.
**Fix:** Strip or ignore `mock` from client-supplied `params` outside test/debug contexts, as part of the validation pass already scoped in the existing "Download route body is brittle" entry.
**Standalone:** yes.

### Remote-node fetch error handler assumes a GraphQL-shaped error body and can throw from inside its own `catch` block

**File:** `modules/graphql-router/src/network/resolvers/fetch.ts:62-66`
**Severity:** low-medium
**Kind:** bug
**Issue:** In the axios error branch, `errorResponse.response.data.errors.map((e) => e.message).join('\n')` is type-asserted, not runtime-checked. If a remote node or an intervening proxy returns a non-GraphQL error body on a non-2xx response (an HTML error page, plain text, a JSON object without `errors`, an empty 502/503/504 body), `.data.errors` is `undefined` and `.map` throws from inside this `catch` block, so the function's promise rejects instead of resolving to a `failure()` result. Contained by the outer `try/catch` in `aggregationPipeline` and the top-level `Promise.allSettled`, so it does not crash the whole network-aggregation request, but the specific, useful error message this branch exists to produce is lost, replaced by a generic fallback, precisely when a misbehaving/misconfigured remote node makes accurate diagnostics matter most. Narrower and more concrete than the already-logged "Remote node response content is not validated" entry, which covers the success path, not this error path.
**Fix:** Validate the shape of `errorResponse.response.data` before accessing `.errors` (e.g. `Array.isArray(data?.errors) ? data.errors.map(...).join('\n') : JSON.stringify(data) ?? 'Unknown error'`), returning a `failure()` result unconditionally rather than risking a throw inside the `catch` block itself.
**Standalone:** yes.

### Two small orphaned files

**File:** `modules/graphql-router/src/es_rest/index.js` (tracked, zero bytes, referenced nowhere); `modules/graphql-router/src/utils/mapHits.js` (a 3-line re-export never imported by anything; the real, actually-used `mapHits` lives at `mapping/utils/mapHits.ts`)
**Severity:** low
**Kind:** dead-code
**Issue:** Confirmed via `git log`/grep that neither file is referenced anywhere in the codebase.
**Fix:** Delete both.
**Standalone:** yes.

### A `date` column with an unparseable value throws `ReferenceError` and kills the entire export

**File:** `modules/graphql-router/src/utils/dataToExportFormat.js:25`
**Severity:** high
**Kind:** bug
**Issue:** `dateHandler`'s default branch reads `debug && console.error('unhandled "date" in dataToExportFormat/dateHandler', ...)`. `debug` is declared nowhere in the file and is not imported; grep finds exactly one other occurrence of the word, at line 277, which correctly uses the threaded `enableDebug`. The file is an ES module, so strict mode applies and reading an undeclared identifier throws. Because `debug &&` evaluates `debug` first, the guard intended to make this log debug-only *is itself* the failure: it converts a soft "unparseable date, return the value unchanged" fallback into a hard error. Confirmed by executing the real built `dataToTSV` against a `displayType: 'date'` column:

```
valid ISO date   -> NO THROW
unparseable date -> THREW: ReferenceError - debug is not defined
'N/A' placeholder-> THREW: ReferenceError - debug is not defined
empty string     -> NO THROW
```

`dist/` is current (newer than source) and contains the line, so this is live in the published package. `N/A`-style placeholders in date columns are ordinary in clinical datasets, so this is a realistic input, not a contrived one. The branch is reached for any column whose `displayType` or `type` is `'date'` with a non-nil value that parses as neither a date nor an integer.
**Fix:** Thread `enableDebug` into `dateHandler` (it already flows to the sibling call sites in `transformDataToTSV`/`transformDataToJSON`), or delete the line. Add a test covering an unparseable date value; note the existing formatter tests cannot catch this because they are disabled, see the entry below.
**Standalone:** yes; one line.
**FIXED 2026-08-17.** Removed the undeclared-`debug` guard so the unparseable-value branch just returns the value, which was the intended fallback. Verified by rebuilding and re-running the repro: `'not-a-date'` and `'N/A'` now emit unchanged instead of throwing. **Found while verifying:** a valid `'2020-01-01'` emits `2019-12-31`, a pre-existing UTC-versus-local off-by-one in the same function, logged separately below.

### `dateHandler` renders dates a day early for negative UTC offsets

**File:** `modules/graphql-router/src/utils/dataToExportFormat.js:15-16` (`isValid(new Date(value))` then `format(new Date(value), dateFormat)`)
**Severity:** medium (silently wrong data in every exported date column, not a crash)
**Kind:** bug
**Issue:** Found while verifying the `ReferenceError` fix directly above, not by inspection. `new Date('2020-01-01')` parses a date-only ISO string as **UTC** midnight per the ECMAScript spec, while `date-fns`' `format` renders in **local** time. On any negative UTC offset (all of North America, so every current Overture deployment) that renders the previous day. Confirmed by running the real built `dataToTSV` with a `displayType: 'date'` column:

```
input '2020-01-01'  ->  emitted "2019-12-31"
```

Every date in every TSV/JSON export is shifted one day earlier for those consumers. This is worse than a crash in one respect: a crash gets reported, whereas a plausible-looking date silently propagates into whatever the researcher does next with the file. It predates the `ReferenceError` and is independent of it.
**Fix:** Needs a deliberate decision on semantics rather than a mechanical change, which is why it is logged rather than fixed alongside the crash. Either parse date-only strings as local (`parseISO` already does this correctly for date-only input, so reordering the `switch` so the `parseISO` branch precedes the `new Date` branch may be most of the fix), or format in UTC (`formatInTimeZone` / an explicit UTC formatter) so the emitted value round-trips the stored value. Pick based on whether an exported date is meant to represent the stored instant or the stored calendar date; for clinical date fields it is almost certainly the calendar date. Add test cases covering a date-only string under a negative-offset `TZ`, which is the case no existing test exercises.
**Standalone:** yes, once the semantics are chosen.

### The export formatter's entire test suite is skipped, and Node reports `skipped 0`

**File:** `modules/graphql-router/src/utils/__tests__/dataToTSV.test.js:7` (`suite.skip(...)`), `:183` (`test.todo`)
**Severity:** high
**Kind:** false confidence (missing test coverage that reads as present)
**Issue:** Five tests covering the TSV export formatter sit inside `suite.skip`. Because the suite is skipped as a unit, its children are never registered, so the summary reports zero skips. Confirmed by running the file directly:

```
﹣ dataToTSV accessor columns (0.201292ms) # SKIP
ℹ tests 0 ... ℹ skipped 0 ... ℹ todo 0
```

In the aggregate `graphql-router` run (`skipped 0`, `todo 0`) there is no signal at all that anything is disabled. Skipped since commit `0a56b9c6`. This materially overstates existing coverage claims: the `/download` and `dataToExportFormat` entries elsewhere in this file read as though `dataToTSV.test.js` provides real downstream coverage of the formatter. It provides none. The accurate statement is that `getAllData` (the row-fetching half, including the `maxRows`/`allowCustomMaxRows` gate) has 8 real tests in `utils/getAllData.test.js`, while the formatter and the route itself have zero executing tests between them.
**Fix:** Un-skip and repair the five tests, or delete the file so the gap is honest. Given the `ReferenceError` above went undetected in exactly this code, repairing is the better option. See also the download-route cluster summarized in [atlas: monorepo review second pass](docs/atlas/monorepo-review-2026-08-17-second-pass.md).
**Standalone:** yes.

### 171 duplicate tests run out of `dist/`, 42% of the package's reported test count

**File:** `modules/graphql-router/tsconfig.release.json:2`
**Severity:** medium
**Kind:** build hygiene / false confidence
**Issue:** The release config's `exclude` is `["./index.ts", "**/__tests__/*"]`, which matches the old-style `__tests__/` directories but not the 20+ co-located `*.test.ts` files. Twenty-seven compiled test files therefore land in `dist/`, and since Node's default test-discovery glob does not exclude `dist/`, `tsx --test` runs them alongside the sources. Measured: the full run reports 407 tests / 103 suites; running only `dist/**/*.test.js` reports 171 tests / 43 suites, leaving 236 real source tests. Same staleness hazard as any `dist/`-executing suite: a deleted or edited source test keeps its stale compiled twin until `clear:dist`. These files also ship in the published tarball (`files: ["dist"]`), which is the concrete instance of the "other internal artifacts may have the same problem" note in the `.turbo/turbo-build.log` entry.
**Fix:** Add `"**/*.test.ts"` and `"**/*.test.js"` to `tsconfig.release.json`'s `exclude` (alongside restoring the parent's `src/admin/**`, per the admin-subtree entry above). Pin an explicit glob in the package's `test` script rather than relying on Node's default. Add a packed-output assertion to `scripts/verify-pack.mjs`, which today checks only dependency specs.
**Standalone:** yes.

---

## modules/charts

### `esToAggTypeMap` duplicated from `modules/types`: the divergence risk has already materialized as a real bug

**File:** `modules/charts/src/arranger/mapping.ts:9` (introduced by #1064, already merged to `main`); compare `modules/types/src/elastic/constants.ts:3` and `modules/components/src/utils/esToAggTypeMap.js:3` (both correctly `byte`, singular)
**Severity:** medium (raised from "low": confirmed materialized, 2026-08-17)
**Kind:** bug (correction: this was previously logged as a hypothetical divergence risk)
**Issue:** The charts module's hand-maintained copy keys the byte ES type as `bytes` (plural), a typo, while the canonical map in `modules/types` (and a copy in `modules/components`) both correctly key it as `byte` (singular, the real Elasticsearch field-type name). Any field whose ES mapping type is genuinely `byte` misses every key in charts' map, so `getGQLTypename` falls through to its default `Aggregations` (categorical) instead of `NumericAggregations`, the field is silently queried and charted as a keyword/bucket aggregation instead of a numeric one. Separately, `modules/components/src/utils/esToAggTypeMap.js` (a third, near-identical copy) has zero importers anywhere in the monorepo, genuinely dead code, not just at risk of divergence.
**Fix:** Apply the already-planned fix (import `esToAggTypesMap` from `@overture-stack/arranger-types/elastic/constants` instead of a local copy), which fixes the typo and removes the divergence risk going forward. Separately, delete the unused `modules/components/src/utils/esToAggTypeMap.js`. See also the `ExtendedMappingInterface.type` mistyping below, the root cause that let this typo go uncaught as a silent misclassification instead of a compile error.
**Standalone:** yes; mechanical import substitution, no logic changes

### TypeScript / declaration diagnostics on successful build

**File:** `modules/charts`; build output
**Severity:** medium
**Kind:** build hygiene
**Issue:** The charts build exits with a success code while emitting TypeScript and declaration file diagnostics. This is a "noisy-successful" build; CI passes, but the output is not actually clean. Published type declarations may be incomplete or incorrect. Most of the noise is implicit-`any` diagnostics from the module's `noImplicitAny` override removal (expected; the build intentionally does not block on these). A smaller set of genuine, non-implicit-any errors remain, confirmed by diffing the build output against the commit immediately before the network-aggregation-charts merge:
    - `Bar/View.tsx`: `dataWithSuppressedValues.find(...).filter(Boolean)` narrows to `(BarData | undefined)[]`, not `BarData[]`; the `filter(Boolean)` call doesn't narrow out `undefined` for TypeScript even though it does at runtime.
    - `Sunburst/View.tsx` and `Sunburst/dataTransform.ts`: nivo's `ComputedDatum`/`OrdinalColorScaleConfig` generics don't line up with the actual node shape used (`children`, `DatumId` vs `string`), and a `.reduce<SunburstData>(...)` call has no matching overload. These appear to be pre-existing sloppy typing that was masked before the module's ES2023 target bump: at ES2020, `.toSorted` didn't resolve, which likely degraded downstream inference to `any` and silently swallowed the mismatch; the target bump made `.toSorted` resolve correctly, which is what surfaced the previously-hidden error.
**Fix:** Resolve the diagnostics so the build is genuinely clean, or explicitly gate `charts` out of the release path until they are fixed. Do not leave it in a state where a successful exit code masks real type errors. For the Sunburst/nivo generics specifically, the fix likely means correcting the node data shape passed to nivo's `ResponsiveSunburst` (or its generic type params) rather than patching each downstream error individually.
**Standalone:** yes; isolated to the charts module; does not affect other packages

### Chart tooltip cannot pluralize custom labels

**File:** `modules/charts/src/components/charts/Tooltip.tsx:38`
**Severity:** low (cosmetic; visible to any operator using a custom label)
**Kind:** incomplete implementation
**Issue:** Added in PR #1074. The tooltip appends `'s'` for counts greater than one (e.g. "Records" vs "Record") using a simple string suffix. The TODO in the file notes that a `pluralize` library call does not work when a custom label is applied via CSS; so operators who override the label text via styling get a suffix on the wrong content. The root cause is that label customization is CSS-based rather than prop-based, leaving no programmatic hook for pluralization logic.
**Fix:** Replace the CSS-based label customization pattern with a `label` prop accepting a singular/plural string pair (e.g. `{ singular: 'Record', plural: 'Records' }`). The pluralization then happens in the component against the prop value rather than against CSS output. The default values maintain the current "Record"/"Records" behaviour.
**Standalone:** yes; component-level change, no server involvement

### No test coverage for Tooltip/TooltipContainer CSS classNames

**File:** `modules/charts/src/components/charts/Tooltip.tsx`; `modules/charts/src/components/TooltipContainer.tsx`
**Severity:** low (no functional impact today; regression risk for external consumers)
**Kind:** missing test coverage
**Issue:** PR #1085 added stable classNames (`tooltip-container`, `tooltip-wrapper`, `tooltip-label`, `tooltip-data`, `tooltip-data-suppressed`, `tooltip-data-value`, `tooltip-data-plural`, alongside the pre-existing `tooltip-data-source-wrapper`/`tooltip-data-source`) plus a `data-label` attribute, specifically so an external consumer (OHCRN) can target Tooltip internals with custom CSS. Neither component has any test coverage. A future refactor could rename or drop any of these classNames with nothing failing in CI, silently breaking downstream styling with no build-time signal, exactly the kind of regression these classNames exist to survive.
**Fix:** Add a render test using `@testing-library/react` (already a devDependency here) asserting each classNames above is present in the rendered output, covering both the suppressed and normal-value branches, plus a case confirming `data-label` reflects the label text. Keep it a presence check rather than a full markup snapshot, so unrelated markup changes don't cause spurious failures.
**Standalone:** yes; test-only addition, no component changes needed

### `TooltipComp` theme override is declared but never wired up

**File:** `modules/charts/src/components/ChartsThemeProvider.tsx:22` (`TooltipComp?: ComponentType`); `modules/charts/src/components/charts/Bar/View.tsx` and `modules/charts/src/components/charts/Sunburst/View.tsx` (both hardcode the built-in `Tooltip` directly; neither reads `useThemeContext().components?.TooltipComp`)
**Severity:** medium (raised from a passing roadmap mention, see driver below)
**Kind:** incomplete implementation
**Issue:** `ChartsThemeProvider`'s `components` prop declares a `TooltipComp` override slot alongside `Loader`/`ErrorData`/`EmptyData`, but only those three are actually consulted anywhere. A consumer passing `components={{ TooltipComp: MyTooltip }}` today gets no error and no effect; their component is silently ignored. This was previously logged only as a "not yet scoped" side-note in [roadmap: Extend the theming engine to all components](roadmap.md#extend-the-theming-engine-to-all-components), which also mischaracterized the prop as "swappable." Elevating priority now that there's a concrete driver: PR #1085 added a `data-label` attribute to the built-in Tooltip so external consumers (OHCRN) can target specific label values with custom CSS, which pushes consumers toward handling CSS-selector escaping for arbitrary label content themselves. A working `TooltipComp` override would let those consumers supply their own tooltip component with direct JS access to `label` instead, avoiding CSS-selector matching, and any escaping, entirely.
**Fix:** In `Bar/View.tsx` and `Sunburst/View.tsx`, read `components?.TooltipComp` from `useThemeContext()` and render it in place of the built-in `Tooltip` when provided, passing the same tooltip data shape (`Bar | SunburstSegment`, or a normalized shape both charts can share). Document the prop and its shape in `modules/charts/README.md`, currently undocumented; only `Loader`/`ErrorData`/`EmptyData` are listed there.
**Standalone:** yes; additive, no change to existing default-Tooltip behaviour

### Bar chart `SUPPRESSION_INCREMENT_VALUE` is not configurable

**File:** `modules/charts/src/components/charts/Bar/View.tsx:10`
**Severity:** low (cosmetic; hardcoded visual increment for suppressed zero-value bars)
**Kind:** missing config option
**Issue:** Added in PR #1074. Zero-value bar suppression uses a hardcoded `SUPPRESSION_INCREMENT_VALUE = 0.2` to render a small visible bar for data values of exactly zero (so the bar is not invisible). The TODO in the file acknowledges this should be a configurable prop. Different chart contexts may need different visual increments depending on axis scale and bar density.
**Fix:** Add a `suppressionIncrement` prop to `BarChartProps` (default `0.2`). Pass it through `BarChart.tsx` to `View.tsx` and replace the module-level constant.
**Standalone:** yes; additive prop, no server involvement

### `NetworkNodesChart`'s colour-map cache key is a hardcoded literal, guaranteeing colour bleed across catalogues/instances

**File:** `modules/charts/src/components/charts/NetworkNodes/View.tsx:77`
**Severity:** high
**Kind:** bug
**Issue:** `NetworkNodeChartView` calls `useColorMap({ fieldName: 'nodes', ... })`, the `fieldName` used for the cache key is the literal string `'nodes'`, not anything that varies per catalogue or dataset. This becomes the fixed sessionStorage key `arranger-charts-nodes`. Any two `NetworkNodesChart` instances in the same browser session, two different catalogues each showing a federated network view, or the same dashboard mounted twice, read and write the exact same sessionStorage entry. Since the colour-wraparound logic depends on what's already in the saved map, a second catalogue's node IDs either collide with an unrelated first catalogue's stored colour, or simply get assigned colours starting from wherever the first catalogue left off: silently wrong, catalogue-crossed colours, not a crash. Real-world exposure: per project context, the dev search-server already runs 5 catalogues, 4 sharing `documentType: "records"`, i.e. multicatalogue-with-shared-identifiers is not hypothetical here.
**Fix:** Stop hardcoding `'nodes'`. Thread `catalogue` and/or `documentType` (both already available on `DataContextInterface`) into the cache key, either via `ChartsProvider`/`useColorMap` folding `catalogue` into the key, or an explicit scoping prop on `NetworkNodesChart`.
**Standalone:** yes.

### `useColorMap`'s sessionStorage read/parse is unguarded (crash risk) and has no SSR check

**File:** `modules/charts/src/hooks/useColorMap.tsx:4-11,23,28,37`
**Severity:** medium
**Kind:** bug
**Issue:** `parseStoredMap` calls `JSON.parse(storedValue)` with no try/catch, and `sessionStorage.getItem`/`setItem` are called unconditionally, directly in the hook's render body. Two concrete failure modes: (1) if the stored value under `arranger-charts-<fieldName>` is ever malformed (a stale shape from a previous package version, another script writing the same-origin key), `JSON.parse` throws synchronously during render with nothing catching it, crashing the surrounding React tree, not just the one chart; (2) there is no `typeof window !== 'undefined'` guard, unlike the existing convention for exactly this kind of browser-storage access already established in `modules/components/src/utils/config.js:6`. Any SSR-rendering consumer would crash outright on `sessionStorage is not defined` the first time a chart renders server-side.
**Fix:** Wrap the `JSON.parse` call in try/catch, falling back to an empty map (and clearing the corrupt key) on failure. Guard both `sessionStorage` calls behind `typeof window !== 'undefined'`, matching the existing `modules/components` pattern. Consider moving the read into a `useMemo`/`useEffect` rather than the render body.
**Standalone:** yes.

### `ExtendedMappingInterface.type` is typed as a UI display-type union, but its real runtime values are raw Elasticsearch mapping types

**File:** `modules/components/src/DataContext/types.ts:47` (`type: DisplayType`) and `:11` (`DisplayType` union has no ES type names at all); consumed at `modules/charts/src/arranger/mapping.ts:35-52` (`getGQLTypename`, needs a raw ES type like `'byte'`/`'keyword'`/`'integer'`)
**Severity:** medium
**Kind:** type-safety
**Issue:** Traced the actual data flow: server-side, `graphql-router/src/mapping/extendMapping.ts:186-213` sets `type` directly from the raw ES mapping (defaulting to `'keyword'`, with its own TODO acknowledging "`type` from `ExtendedConfigs` and `FieldFromMapping` do not match... Issue with `byte`"); client-side, `DataContext/helpers.ts:53` assigns that server value straight into state with no transform. So `ExtendedMappingInterface.type`'s real values are always raw ES types, never `DisplayType` members, the interface's declared type for this field is simply wrong, most likely copy-pasted from the adjacent, genuinely-`DisplayType`-typed `ColumnMappingInterface.type` one interface up. The consequence lands in `modules/charts`: its `esToAggTypeMap` has to widen its key type with `| string` specifically to route around this incompatibility, and this is exactly what let the `bytes`/`byte` typo above go uncaught as a silent runtime misclassification instead of a compile error. Also directly confirmed via `modules/charts/src/arranger/mapping.test.ts` (added in the latest commit) failing to type-check: `npm run build` reports `Type '"integer"' is not assignable to type 'DisplayType | undefined'`.
**Fix:** Correct `ExtendedMappingInterface.type`'s declared type in `DataContext/types.ts:47` to reflect what it actually holds (a raw ES mapping type string, or a proper union of ES type literals). A correctly-typed field plus a non-widened lookup table would have made the `esToAggTypeMap` typo a compile error instead of a silent runtime bug.
**Standalone:** yes, though it will surface the charts-side `| string` widening as newly-unnecessary once fixed; do both in the same pass.

### `HeadlessChart` is exported from the public API with its implementation entirely commented out; crashes under the package's own supported React 17 peer range

**File:** `modules/charts/src/components/Headless.tsx:13`; exported via `modules/charts/src/main.tsx`
**Severity:** medium-high
**Kind:** bug
**Issue:** `HeadlessChart`'s body has every line commented out and returns nothing (implicit `undefined`), but it's still exported from the package's top-level entry point, fully public, with no `@deprecated`/`@experimental` tag and no README mention. `modules/charts/package.json` declares `"react": "^17.0.0 || ^18.0.0"` as a supported peer; React 17 (unlike 18) throws a runtime error when a function component returns `undefined`, so any consumer on the documented-supported React 17 who renders `<HeadlessChart>` gets an unconditional crash, not silence.
**Fix:** At minimum, `return null;` explicitly so it degrades safely under React 17 too, and add a `@deprecated`/`@internal` tag plus a README note that it's non-functional pending rework. Alternatively, drop it from `main.tsx`'s exports until the rework lands.
**Standalone:** yes for the `return null` fix.

### `requireNetworkSearch` is a one-way flag: never resets after the chart that needed it unmounts

**File:** `modules/charts/src/components/Provider/useQueryFieldNames.tsx:29,96-98`; triggered from `modules/charts/src/components/charts/NetworkNodes/NetworkNodesChart.tsx:47-49`
**Severity:** medium
**Kind:** bug
**Issue:** `NetworkNodesChart`'s mount effect calls `requireNetworkSearch()` with no cleanup function. Confirmed via grep: no call site anywhere ever sets it back to `false`; `removeQuery`/`deregisterChart` only remove entries from the field maps, they don't touch this flag. Once any `NetworkNodesChart` has mounted even briefly under a given `ChartsProvider`, every subsequent aggregation query keeps requesting the federated `network` block for that provider's lifetime, even after the component that needed it is gone, ongoing, unnecessary fan-out queries to remote Arranger nodes for the rest of the session.
**Fix:** Replace the sticky boolean with a reference count (increment on register, decrement on the chart's unmount cleanup), mirroring the pattern `registerChart`/`deregisterChart` already use for individual fields.
**Standalone:** yes.

### `useNetworkQuery`'s `apiFetcher` parameter is typed `any`, bypassing `arranger-components`' own `APIFetcherFn` contract

**File:** `modules/charts/src/hooks/useNetworkQuery.tsx:49`
**Severity:** low-medium
**Kind:** type-safety
**Issue:** Nothing checks that the object built by `buildNetworkQueryFetchArgs` (`body`, `url`) actually matches `APIFetcherFn`'s current shape. It lines up today, but `APIFetcherFn` has changed shape before (`body` becoming optional, a `signal` field added per the 3.1 changelog), and this is the exact integration point responsible for the catalogue-scoping bug this package already had once (`useNetworkQuery`/`ChartsProvider` losing `apiUrl`, now fixed). Losing type coverage here means a future `APIFetcherFn` change would silently fail to propagate instead of surfacing as a compile error.
**Fix:** Import and use `APIFetcherFn` from `@overture-stack/arranger-components` instead of `any`.
**Standalone:** yes.

### `Bar` and `NetworkNodes`'s nivo config files are byte-for-byte identical; their `colorMapResolver` functions are duplicated too

**File:** `modules/charts/src/components/charts/Bar/nivo/config.tsx` and `NetworkNodes/nivo/config.tsx` (confirmed identical via `diff`, zero output); `Bar/View.tsx:32-48` and `NetworkNodes/View.tsx:21-37` (identical `colorMapResolver` bodies)
**Severity:** low-medium
**Kind:** duplication
**Issue:** Same category of risk as the `esToAggTypeMap` duplication above: a future fix or tweak to one copy (axis config, colour wraparound logic) has no mechanism forcing the other to follow.
**Fix:** Extract `arrangerToNivoBarChart` into one shared module imported by both; extract the shared `colorMapResolver` into `useColorMap.tsx` or a small shared utility used by both `View.tsx` files.
**Standalone:** yes.

### Missing test coverage on non-trivial exported logic: Sunburst segment building, GraphQL-to-bucket transform, query-string builders

**File:** `Sunburst/dataTransform.ts` (`createSunburstSegments`); `Provider/dataTransform.ts` (`gqlToBuckets`); `gql/index.ts` (`queryTemplateAggregations`, `queryTemplateNumericAggregations`, `gqlStringifyObject`)
**Severity:** low-medium
**Kind:** test-coverage
**Issue:** No test file exists for any of these three, unlike their siblings (`mapping.ts`, `useNetworkQuery.tsx`, `query/generateCharts.ts`), which now all have `node:test` suites. `createSunburstSegments` does non-trivial grouping/sorting/filtering that directly determines every Sunburst chart's rendered content. `gqlToBuckets` handles the `__missing__` → "No Data" remap and branches on `__typename`, get it wrong and every chart's data is silently wrong. The `gql` builders hand-build raw GraphQL query strings with no lower-level type checking.
**Fix:** Add `node:test` suites for all three, following the pattern already established in the package's other test files.
**Standalone:** yes.

### Tooltip pluralization threshold excludes zero

**File:** `modules/charts/src/components/charts/Tooltip.tsx:43`
**Severity:** low
**Kind:** bug
**Issue:** Distinct from the existing "Chart tooltip cannot pluralize custom labels" entry above (that one is a CSS/label-override problem). This is a narrower issue in the same line: `{value > 1 ? 's' : ''}` treats `value === 0` as singular ("0 Record"), when standard English pluralization treats every count except exactly 1 as plural. `Bar` never hits this for a real zero (suppressed and routed to the "Too few" branch instead), but `SunburstSegment`'s own type comment confirms Sunburst segments are never suppressed, so a legitimate zero-count Sunburst segment shows "0 Record" instead of "0 Records."
**Fix:** Change the condition to `value !== 1 ? 's' : ''`.
**Standalone:** yes.

### `arranger-components` is declared peer-only, which will break the first `pnpm install`; the phantom-dependency audit could not see it

**File:** `modules/charts/package.json` (`peerDependencies: { "@overture-stack/arranger-components": "*" }`, absent from both `dependencies` and `devDependencies`)
**Severity:** high (blocks [roadmap §3.3](roadmap.md#33-migrate-from-npm-to-pnpm), currently marked "next up")
**Kind:** bug (dependency declaration)
**Issue:** Confirmed directly: `@overture-stack/arranger-components` appears only under `peerDependencies`, as `*`. Seven source files import it (`arranger/mapping.ts`, `components/Provider/Provider.tsx`, `components/charts/validate.tsx`, `components/charts/Bar/BarChart.tsx`, `components/charts/Sunburst/SunburstChart.tsx`, `hooks/useNetworkQuery.tsx`, `hooks/useNetworkQuery.test.ts`). It resolves today only because npm hoists a workspace symlink to the repo root (`node_modules/@overture-stack/arranger-components -> ../../modules/components`, verified present). Under pnpm's strict isolation, a peer-only declaration with no dev or prod counterpart is not linked into the package's own `node_modules`, so the build fails.

**Why this was missed, and why that matters more than the fix:** the phantom-dependency audit (2026-08-15) recorded `modules/charts` as clean. `depcheck` counts a `peerDependencies` entry as declared, so it cannot see this class. That is the **second** confirmed `depcheck` blind spot, after `ts-patch` (a shell-invoked binary rather than a JS import, caught only by building a real pnpm prototype). Two blind spots means the audit's "clean" verdict for `apps/mcp-server` and `modules/sqon` rests on weaker evidence than it reads as.
**Fix:** Declare `@overture-stack/arranger-components` as a `devDependency` alongside the existing peer range (matching how `integration-tests/import` declares `"file:../../modules/components"`), and replace the `*` peer with a real range once versions exist. Before the migration, re-audit dependencies by a method that does not share depcheck's assumptions, since two of its blind spots are now confirmed. Separately, `scripts/verify-pack.mjs` checks only for `file:`/`workspace:` prefixes, so a `*` spec passes the release gate untouched; extend it to reject `*` and `latest` on any `@overture-stack/*` spec.
**Standalone:** yes for the declaration; the re-audit is its own task and belongs on §3.3's checklist.

---

## modules/components

### `LiveAdvancedFacetView`/`MatchBoxState` bypass `DataContext` entirely, and are currently unreachable

**File:** `AdvancedFacetView/LiveAdvancedFacetView.js`, `MatchBox/MatchBoxState.js` (and `Arranger/MatchBox.jsx`, its only caller)
**Severity:** low today (unreachable; would become medium the moment either is resuscitated, since the bug would then be live)
**Kind:** bug (multicatalogue correctness) + dead export, in the same two files
**Issue:** Both import `defaultApiFetcher`/the default `api` export from `utils/api.ts` directly rather than going through `useDataContext()`, so they ignore a `DataProvider`'s `apiUrl` entirely, always hitting the fetcher's own unscoped default (`ARRANGER_API`). Same shape as the `Aggregations` bug fixed 2026-08-05 (see CHANGELOG) and the still-open `AdvancedSqonBuilder` one below. Currently unreachable either way: both components' exports from `Arranger/index.js` are commented out (lines 4 and 5), and nothing else in the module renders them. Not treated as disposable cruft: these are planned to be resuscitated eventually, not deleted, so the bypass is debt to fix as part of that work, not now.
**Fix:** When either is picked back up: re-wire through `useDataContext()` (or accept `apiUrl` as an explicit prop, matching whatever the resuscitation plan settles on) instead of importing the fetcher module directly, and re-export from `Arranger/index.js`. Do this before or alongside re-enabling the export, not after, so it's never live and broken at the same time.
**Standalone:** no; blocked on whatever "resuscitate these" work looks like, not a fix to do in isolation right now

### Quicksearch regex as potential injection / ReDoS vector

**File:** TBD; Quicksearch component and its ES query builder (not yet implemented)
**Severity:** medium (OWASP A05: Injection)
**Kind:** security consideration
**Issue:** If Quicksearch is extended to support regex or wildcard input, user-provided patterns would be forwarded to Elasticsearch's `regexp` or `wildcard` query type. Two risks: (1) a crafted pattern could expose unintended records (injection); (2) a pathological regex can cause catastrophic backtracking in the ES query engine (ReDoS / availability attack). ES has some protections (`max_determinized_states`) but they are not a complete defence.
**Fix:** Needs design before implementation. Options: sanitize/escape input and restrict to prefix-style patterns only; document that regex support is explicitly not offered; or apply strict server-side pattern validation before forwarding to ES.
**Standalone:** needs-context; tied to the Quicksearch-in-facets roadmap item. Must be resolved in the design phase, not retrofitted.

### `integration-tests/server` missing OpenSearch client dependency

**File:** `integration-tests/server/package.json`
**Severity:** medium
**Kind:** missing dependency
**Issue:** The integration test suite already supports multiple search engines via `SEARCH_ENGINE` env var and `buildSearchClient({ client: searchEngine })`, but `@opensearch-project/opensearch` is not listed as a dependency; only `@elastic/elasticsearch`. Running the suite with `SEARCH_ENGINE=opensearch` would fail to resolve the client.
**Fix:** Add `@opensearch-project/opensearch` to dependencies. Confirm that `buildSearchClient` in `graphql-router` supports it (the `SupportedClientTypes` type implies it does). Add an OpenSearch container to the CI pod spec (or adopt testcontainers; see [roadmap §3.2](roadmap.md#32-testcontainers-for-integration-test-infrastructure)) and run the suite against both engines.
**Standalone:** mostly yes; the test harness is already wired; this is the last missing piece before OS integration tests actually run

### No integration test verifying `/introspection/fields` reflects the live ES mapping

**File:** `integration-tests/server/test/spinupActive.js`
**Severity:** medium (regression risk; the correctness fix has no integration-level guard)
**Kind:** missing test coverage
**Issue:** The unit tests for `buildCatalogueIntrospectionBody` verify the response shape and operator logic in isolation. The integration tests verify the endpoint responds with `200 OK` and that the response has the right shape. But no test verifies that the field list in `/introspection/fields` actually reflects the live ES index mapping; i.e. that a field present in the ES mapping but absent from the config files appears in the response. Without this, the correctness fix (subroute aliasing to each `arrangerRouter`'s live-resolved fields) can silently regress.
**Fix:** In `spinupActive.js`, after fetching `/introspection/fields`, assert that `Object.keys(data.fields).length` matches the field count from the live ES index (e.g. via a separate `GET /<index>/_mapping` call, or by asserting against a known field that is in the ES mapping but deliberately absent from the test fixture's config files). The simplest approach: add a fixture field directly to the ES test index that is not present in any config file, then assert it appears in the introspection response.
**Standalone:** yes; additive test, no changes to application code

### Shallow git clone breaks `GIT_PREVIOUS_COMMIT`-based change detection

**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`
**Severity:** medium (silently disables change detection; everything would fall back to HEAD^1 or fail)
**Kind:** ops risk
**Issue:** The pipeline uses `GIT_PREVIOUS_COMMIT` (set by the Jenkins Git plugin) as the base for all git diff comparisons. If the Jenkins checkout is configured with `--depth 1` (shallow clone), `GIT_PREVIOUS_COMMIT` will not be reachable in the local git history and `git diff ${turboBase} HEAD` will fail. The pipeline comment documents this requirement, but there is no runtime guard; a misconfigured checkout silently degrades or errors.
**Fix:** Either add a guard (`git cat-file -e ${turboBase} || turboBase = 'HEAD^1'`) to detect and recover from an unreachable commit, or document the shallow-clone restriction in DEVELOPMENT.md alongside the Jenkins setup notes.
**Standalone:** yes; purely a pipeline change; no application code involved

### `arranger-iobio` deploy references old `arranger-server` image name

**File:** infra repo; deploy config for `arranger-iobio` on `overture-dev`
**Severity:** medium (deploy will reference a stale image name after the Docker rename lands)
**Kind:** naming regression
**Issue:** The `Deploy to overture-dev` stage deploys `arranger-iobio` via `stepRunDeployJob.updateAppVersionOverture`. That job's infrastructure config (in the infra repo) references the Docker image by name. Renaming `ghcr.io/overture-stack/arranger-server` to `ghcr.io/overture-stack/arranger-search-server` in the pipeline will break the deploy until the infra config is updated.
**Fix:** Update the image reference in the `arranger-iobio` deploy config in the infra repo to `ghcr.io/overture-stack/arranger-search-server`. Coordinate with the pipeline change landing.
**Standalone:** yes; one-line config change in the infra repo; no code changes

### `release-charts` temporary publish branch

**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy` ("TEMP. Publish Charts to NPM" stage)
**Severity:** low
**Kind:** design-smell
**Issue:** A `release-charts` branch triggers a separate, explicitly temporary stage to publish `modules/charts` to NPM. This is a workaround, not a solution. It runs outside the normal release process and has no change detection.
**Fix:** Fold charts publishing into the standard `release` branch publish loop, which already iterates over `modules/*` and publishes packages with version changes. Remove the `release-charts` branch and the TEMP stage.
**Standalone:** yes; small, self-contained pipeline cleanup

### SQONViewer requires the top-level SqonNode to always be a combination; crashes on a bare leaf

**File:** `modules/components/src/SQONViewer/index.jsx:39` (`const sqonContent = sqon?.content || [];`, then `.map()`); several more unguarded `.content`-as-array call sites in `SQONViewer/utils.js` (merge/toggle/wildcard-filter helpers, `findFilter`, `getSQONValue`, roughly lines 21-183)
**Severity:** medium-high (confirmed real crash, not theoretical)
**Kind:** bug / missing defensive check
**Issue:** `index.jsx`'s render loop assumes `sqon.content` is always an array, with no `Array.isArray` guard. A single-filter `SqonNode` built via `@overture-stack/sqon`'s `SqonBuilder` (e.g. `SqonBuilder.and([oneFilter]).toValue()`) collapses to the bare leaf itself (`reduceSqon`'s documented single-item unwrap), so `content` becomes `{fieldName, value}`, an object, not an array. `.map()` on that throws `sqonContent.map is not a function`. Confirmed hit in production-adjacent code: [OHCRN/platform#1964](https://github.com/OHCRN/platform/pull/1964), migrating `researcher-ui`'s SQON helpers onto `@overture-stack/sqon`. The workaround there was to avoid `SqonBuilder` and hand-wrap in a plain `{op: 'and', content: [newFilter]}` literal for that one call site, correct, but it pushes the burden onto every caller to know about this instead of the viewer handling a valid `SqonNode` shape gracefully.

The pattern to fix it already exists in this same file: `removeSQON` (`utils.js:304`) already checks `Array.isArray(sqon.content)` before assuming array shape, falling back to a bare-fieldName check when it isn't. The other call sites listed above don't have this guard and would need the same treatment for the fix to be consistent across the whole viewer, not just the top-level render loop.

**Fix:** Audit `index.jsx`'s render loop and the `utils.js` call sites above, applying `removeSQON`'s existing defensive pattern (or equivalent) to each: treat a bare leaf as an implicit one-item list rather than assuming a combination. This is a genuine, if mechanical, audit across multiple functions, not a one-line change. Once done, `@overture-stack/sqon` consumers no longer need to pre-wrap a lone filter just to satisfy the viewer. In the meantime, `asCombination(node)` (already added to `@overture-stack/sqon`) is the documented escape hatch for callers who need a guaranteed-combination shape before this lands.
**Standalone:** the `index.jsx` render-loop fix alone is small and testable on its own; the full `utils.js` audit is a bigger lift. Tests are required in the same change either way, per the rendering-coverage entry below: this is exactly the kind of rendering-path gap that already shipped one real regression unnoticed (see that entry for the history).

### No rendering-level unit test coverage in `modules/components`; SQONViewer is the natural starting point

**Files:** `modules/components/src/` (all rendering components); confirmed via survey (updated 2026-08-17; the file count below is now stale relative to an earlier version of this entry, which listed 5): `SQONViewer/utils.test.js`, `SQONViewer/__tests__/utils.test.js`, `TextFilter/__tests__/TextFilter.test.js`, `utils/__tests__/splitString.test.js`, `utils/uri/__tests__/uri.test.js`, `DataContext/arrangerConfigParsing.test.ts`, `QuickSearch/QuickSearchQuery.test.js`, `ThemeContext/utils.test.ts`, `aggregations/Aggregations.test.jsx`, `aggregations/AggsQuery.test.jsx` (10 files total)
**Severity:** medium (regressions in rendering logic ship silently)
**Kind:** missing test coverage
**Issue:** Across the whole `modules/components` package, only ten test files exist (five more than an earlier version of this entry counted), and none exercise actual component rendering; every one of the five newer files calls a component/function directly and asserts on its return value (a plain object, or a React element's `.props`) rather than rendering to a DOM, none use `@testing-library/react`/`jsdom`. The core conclusion is unchanged: no component that renders JSX has real DOM-level test coverage. A real instance already shipped from this exact gap: a bubble-rendering regression (multi-value filters collapsing into one joined bubble instead of one bubble per value) went unnoticed for over a year, since `index.jsx`'s rendering logic had zero coverage of any kind. That specific regression is now fixed and guarded (2026-07-31), but by extracting its value-construction logic into a pure, unit-tested function (`getValueSQONValues` in `SQONViewer/utils.js`), not by adding rendering coverage; the systemic gap this entry describes is still fully open. Also worth correcting here: `@testing-library/react` is not actually installed in this package, and the Jest config (`testEnvironment: 'node'`) has no DOM available at all, contrary to an earlier assumption in this entry; closing this gap for real needs both added first; it is not just a matter of writing the tests. Separately, `SQONViewer/__tests__/utils.test.js` (old-style, non-co-located) contains a no-op assertion (`it('should return the query if no base sqon', () => { expect(false).toBe(false); })`) that passes regardless of the code under test; existing coverage is thinner than the file count suggests. `SQONViewer/utils.test.js` (co-located) and `SQONViewer/__tests__/utils.test.js` (old-style) both exist side by side and test different functions, not duplicates, but the latter should be relocated per the [co-location convention](#inconsistent-unit-test-file-placement).
**Fix:** Add a `jsdom` test environment and `@testing-library/react` (version-checked before adding, per dependency-version convention) as the actual prerequisite, then pilot real rendering assertions on `SQONViewer/index.jsx` (the bare-leaf-crash entry above is a good second candidate once this lands). Fix the no-op test in `__tests__/utils.test.js` while relocating it to co-located `utils.test.js` alongside the other `addInSQON`/`toggleSQON`/`mergeQuery` tests it actually covers (careful: this would collide with the existing co-located `utils.test.js`, which tests `isWildcardFilter`/`getValueSQONValues` from the same `utils.js`; merge into one file rather than overwriting). Once the pattern is established, extend to other high-traffic rendering components (Table, Aggs family) opportunistically as they're touched.
**Standalone:** yes; the test-infra addition is the actual first step and is standalone; broader extension to other components is opportunistic, not a blocking prerequisite

### Columns button disabled when no columns are shown by default

**File:** `modules/components/src/`; column selector / table component
**Severity:** low
**Kind:** bug
**Issue:** When no table columns are configured to show by default, the columns button (which lets users add/show columns) is also disabled, trapping users with no way to show any columns.
**Fix:** The button should remain enabled regardless of whether any columns are currently visible; its purpose is precisely to let users change that state.
**Standalone:** yes

### `defaultApiFetcher`'s response cache never invalidates or scopes by caller

**File:** `modules/components/src/utils/api.ts` (existing `// TODO: create a different cache per context/caller;` already names this)
**Severity:** medium (stale data can be served indefinitely with no way to force a refresh)
**Kind:** design gap
**Issue:** Every request through the default fetcher is cached in one process-wide `Map`, keyed by `JSON.stringify(args)`, with no TTL and no invalidation of any kind. Once a given `{endpoint, url, method, body, ...}` shape has been requested once, every later call with the same shape returns the original cached response forever, even if the underlying catalogue's data, schema, or availability has since changed. Noticed while adding `signal` (`AbortSignal`) support for `useArrangerConfig`'s cancellation: an aborted request is never cached (the `cache.set` after `await axios(...)` is only reached on success, so this part is safe), but the cache's total lack of scoping or expiry is a pre-existing gap independent of that change.
**Fix:** Scope the cache per consumer/context rather than one shared module-level `Map` (the existing TODO's own suggestion), and/or add a TTL or explicit invalidation hook. Needs design: what should invalidate a cached introspection or config response when a catalogue's `GET /ready`/`GET /introspection` status changes, versus what's safe to cache indefinitely (static config shape rarely changes at runtime).
**Standalone:** needs-context; touches every consumer of the default fetcher, not just `useArrangerConfig`

### `AdvancedSqonBuilder` has no `apiUrl` prop anywhere in its chain, so it can't respect a catalogue-scoped base URL

**File:** `modules/components/src/AdvancedSqonBuilder/` (`index.jsx`, `filterComponents/index.jsx`, `filterComponents/BooleanFilter.jsx`/`TermFilter.jsx`/`RangeFilter.js`), `utils/ExtendedMappingProvider.jsx`, `utils/api.ts` (`fetchExtendedMapping`)
**Severity:** medium (silently wrong catalogue in multicatalogue mode, same shape as the `Aggregations` bug just fixed; lower urgency since this family isn't `withData`-wrapped, so a consumer must already wire `apiFetcher` manually and would notice something's off sooner)
**Kind:** bug (multicatalogue correctness)
**Issue:** Confirmed by grep: `apiUrl`/`url` appears nowhere across the whole `AdvancedSqonBuilder` component tree. Every internal query (`BooleanFilter.jsx`/`TermFilter.jsx` via `Query.jsx`, and `fetchExtendedMapping()` via `ExtendedMappingProvider.jsx`, called from `filterComponents/index.jsx`) calls `apiFetcher(...)` with no `url`, so it always falls back to the fetcher's own internal default (`ARRANGER_API` for `defaultApiFetcher`), never a catalogue-scoped base, no matter what `apiFetcher` a consumer supplies. Same root cause as the `Aggregations` fix (2026-08-05, see CHANGELOG), not addressed here since this family isn't auto-wired to `DataContext` at all (no `withData`), so fixing it means adding a new `apiUrl` prop through the whole chain, not just forwarding an existing one.
**Fix:** Add an `apiUrl` prop to `AdvancedSqonBuilder`, thread it through `filterComponents/index.jsx` to `BooleanFilter.jsx`/`TermFilter.jsx`/`RangeFilter.js` (pass to `<Query url={apiUrl}>`) and to `ExtendedMappingProvider`/`fetchExtendedMapping` (add a `url` param there, matching `useConfigs`/`useDataFetcher`'s existing pattern). `saveSet.js`'s `graphql()` caller (`Arranger/MatchBox.jsx`) does not need this: confirmed dead, unreachable code (its own export from `Arranger/index.js` is commented out, and nothing else renders it).
**Standalone:** touches the exact files [roadmap: Components module modernization](roadmap.md#components-module-modernization) already names as the first `component-component`-removal target (`AdvancedSqonBuilder/index.jsx`, `SqonEntry.js`, `sqonPieces/*`, `filterComponents/*`, and `utils/ExtendedMappingProvider.jsx` specifically). Not blocked on that work, but doing this fix in isolation means touching these same lines twice if the modernization pass follows soon after; whoever picks up either should check the other first.

### `DownloadButton`'s exporter customization reads as `'saveTSV'`-only, but accepts any function

**File:** `Table/DownloadButton/DownloadButton.tsx` (the component's JSDoc), `DownloadButton/types.ts` (`ExporterFunction`, `CustomExporterDetailsInterface`), `DownloadButton/helpers.ts` (`saveTSV`, `processExporter`)
**Severity:** low (no functional gap, a real documentation one; confirmed hit in practice)
**Kind:** documentation gap
**Issue:** `theme.customExporters.function` accepts `ExporterFunction | 'saveTSV'`, a real callback `(exporter: ExporterFunctionProps, downloadFunction?: DownloadFunction) => void` is a fully supported alternative to the `'saveTSV'` sentinel, receiving `sqon`/`selectedRows`/`url`/`files` plus the same `download` utility the built-in exporter itself uses. The component's own JSDoc ("This attribute accepts `'saveTSV'` to use the default functionality") doesn't make the general callback case clear enough: the iMicroSeq portal UI integration read it and concluded `{ function: 'saveTSV' }` was the only usable value, blocking a Google Analytics download-tracking customization that the API already supports. Separately, `saveTSV` (the built-in exporter, with its more sophisticated per-column customizer handling) is not exported from `modules/components`'s public entrypoint, only the `DownloadButton` component is, so a consumer wanting to keep the exact built-in behaviour while adding a side effect (analytics tracking, for instance) cannot cleanly wrap it today; they can only reimplement a simpler download call themselves via the provided `downloadFunction`.
**Confirmed concretely, not just theoretically (2026-08-16):** the same integration needed the *customized-columns* path (a `columns` array with function-valued `displayFormat`/`displayName` overrides resolved against `allColumnsDict`, `saveTSV`'s `useCustomisers` logic), not just the simple default-columns case. They ended up with a verbatim copy of that internal logic in their own codebase to keep working analytics tracking without silently dropping column formatting, real, working duplication of non-trivial logic that will drift the moment `saveTSV` changes.
**Fix:** Improve the inline JSDoc to lead with "pass your own function for full control, or `'saveTSV'` for the built-in behaviour," and add a short custom-function example. Structural fix decided and now on the roadmap: [`DownloadButton` `onExport` callback](roadmap.md#downloadbutton-onexport-callback) (option (2) below), a more direct fit for the actual need class than exporting `saveTSV` would be. Kept here as the interim record: (1) export `saveTSV` from the public entrypoint so a custom function can wrap it directly instead of reimplementing the download call and column-customizer logic, or (2) add a public `onExport` callback prop, fired for any exporter path regardless of whether it's `'saveTSV'` or custom. Not mutually exclusive with (1), which remains undecided. A related but separately-scoped `saveCSV` export format is also now on the roadmap: [`saveCSV` export format](roadmap.md#savecsv-export-format). Full treatment (a real docs page with examples for each customization point) belongs in a proper Components section of `/docs`, not yet planned; this entry is the interim record until that exists.
**Standalone:** yes; the JSDoc improvement, the `saveTSV` export, and the `onExport` prop are all small, independent changes

**See also the `Aggregations` entry below:** same underlying root cause (a plain-JS component with real, working props that have no corresponding TypeScript interface, making them invisible to a consumer doing type-based discovery), confirmed as a second, independent instance the same day, not a one-off.

### `Aggregations`'s `onValueChange` callback exists and works, but has no TypeScript type

**File:** `aggregations/Aggregations.jsx` (the `onValueChange` prop), `aggregations/types.ts` (only exports `AggsStateProps` and theme-styling types; no props interface for `Aggregations`/`AggregationsList`/`AggregationsListDisplay` exists at all)
**Severity:** low (no functional gap; confirmed hit in practice, same day as the `DownloadButton` case above)
**Kind:** documentation/typing gap
**Issue:** `<Aggregations onValueChange={(value) => {...}}>` fires for every facet interaction across all agg types (term/keyword, boolean, date, range; wired per-type in `aggComponentsMap.jsx`), with the new `sqon` and a `value` payload (`{ fieldName, isActive, value }` for term/keyword facets, where `value.value` is the raw ES bucket). This is exactly the hook a consumer wanting facet-interaction analytics needs, and it already exists. But since `Aggregations.jsx` is plain JS with no corresponding props interface, this is invisible to anyone discovering the API by reading generated types rather than source, confirmed directly: the iMicroSeq integration checked `Aggregations/types.d.ts`, found nothing resembling `onChange`/`onFilter`, and reasonably concluded no hook existed. Separately worth noting for whoever picks this up: `isActive` reflects whether the *field* has any active filter after the click, not whether the specific clicked value was added or removed, a real precision gap for multi-select facets that a proper type/doc pass should call out explicitly, not just the prop's existence.
**Fix:** Add a proper TypeScript props interface for `Aggregations`/`AggregationsList`/`AggregationsListDisplay` in `aggregations/types.ts`, documenting `onValueChange`'s exact payload shape per agg type and the `isActive` field-vs-value caveat above. Likely not the only plain-JS component in this package with the same gap; worth a broader pass once the pattern is confirmed more than twice, tracked against the ongoing JS → TS migration rather than fixed ad hoc per component.
**Standalone:** yes; additive typing, no behaviour change

### `Stats`/`CombinedStatsQuery` has the same `apiUrl` gap as `AdvancedSqonBuilder`

**File:** `modules/components/src/Stats/Stats.jsx`, `Stats/CombinedStatsQuery.jsx`
**Severity:** medium, same reasoning as the `AdvancedSqonBuilder` entry above: not `withData`-wrapped (`export default Stats;` is the bare function), so a consumer already has to wire `apiFetcher` manually and would likely notice something's missing, unlike `Aggregations`/`QuickSearch`, which looked correctly auto-wired while silently querying the wrong catalogue.
**Kind:** bug (multicatalogue correctness)
**Issue:** Confirmed by grep: neither file has `apiUrl` anywhere. Both render `<Query>` directly with `apiFetcher` but no `url`, so any `Stats` usage falls back to the fetcher's own unscoped default, same root cause as `Aggregations`/`AdvancedSqonBuilder`/`QuickSearch`.
**Fix:** Add an `apiUrl` prop to `Stats`, thread it to `CombinedStatsQuery` and each internal `<Query url={apiUrl}>` call.
**Standalone:** yes

### `QuickSearch` sends `op: 'wildcard'` unconditionally, breaking against any server older than the 3.1 cycle

**File:** `QuickSearch/QuickSearchQuery.js:108`
**Severity:** high (confirmed, unconditional break, not an edge case: every quicksearch query is affected)
**Kind:** backward-compatibility bug
**Issue:** `QuickSearchQuery.js` hardcodes `op: 'wildcard'` on every query it builds, with no fallback. Server-side acceptance of `op: 'wildcard'` (`WILDCARD_OP`) was added in commit `aea90ecb` (2026-06-30, "rename 'filter' sqon operation to 'wildcard'"), part of the same 3.1 development cycle as this Components release; confirmed via `git log -p` on `modules/graphql-router/src/middleware/buildQuery/index.js`. Any server build before that commit only recognizes `op: 'filter'` (`opSwitch`'s `else` branch throws `unknown op`). So a deployment running Components 3.1.0 against a server older than that commit has QuickSearch broken outright, even though the deployment otherwise didn't change. `SQONViewer/utils.js`'s `isWildcardFilter` already accepts both names defensively for display, but nothing on the query-building side emits the older, more widely-supported name. `docs/reference/08-Migration/v3.1.md` (the guide the root `CHANGELOG.md` points to for upgrade instructions) does not mention this at all.
**Fix:** Short-term: emit `op: 'filter'` instead of `'wildcard'` in `QuickSearchQuery.js`; the current server already accepts both, so this works against old and new servers alike, at the cost of the client emitting a name the changelog calls a deprecated alias. Real fix is architectural: see [roadmap: capability-aware consumer components via `DataContext`](roadmap.md#capability-aware-consumer-components-via-datacontext), which proposes `DataContext` exposing what the connected server actually supports so components like this one branch on a real capability check instead of assuming the newest wire format.
**Standalone:** yes, the short-term op-name swap is a one-line change; the architectural fix is not.

### `columnsToGraphql`'s score-sort transform crashes on an unguarded regex match, on a path that runs on every table data request

**File:** `modules/components/src/utils/columnsToGraphql.js:77-86`
**Severity:** medium-high
**Kind:** bug
**Issue:** When building the `score` GraphQL variable for a table sorted by a "hits.total"-style relevance column: `const match = s?.fieldName?.match?.(/((.*)s)\.hits\.total/); return \`${match[1]}.${match[2]}_id\`;`, no null-check on `match`. Confirmed directly: `"hits.total".match(/((.*)s)\.hits\.total/)` returns `null` (the pattern requires at least one character ending in a literal `s` before `.hits.total`; a bare, unprefixed `"hits.total"` doesn't satisfy it). The preceding `.filter()` only checks `fieldName.indexOf('hits.total') >= 0`, satisfied by non-matching values too, so a non-matching value reaches `match[1]` and throws `TypeError: Cannot read properties of null`, crashing the whole `columnsToGraphql()` call and every table fetch using that sort. The sibling transform three lines above guards its own regex result before use; this one doesn't, looking like an oversight rather than a deliberate assumption. The file carries its own TODO acknowledging this class of risk ("we may have a graphql field vs arranger fieldname issue here. Must test and validate"). Zero test files reference `columnsToGraphql` anywhere; it's called from `DataContext/helpers.ts:95` inside `useDataFetcher`, i.e. on every table data request. Reachability in production against a real "hits.total"-style sort fieldName that doesn't fit the `<entity>s.hits.total` shape needs verification against actual nested/network-search column configs, but the crash mechanics themselves are confirmed.
**Fix:** Guard the match (`if (!match) return null;`, or fall back to `fieldName` unchanged), and add a unit test for the score-building branch, including a fieldName that doesn't fit the `s.hits.total` shape.
**Standalone:** yes.

### Every button in the package defaults to `type="submit"`; no control anywhere sets `type="button"`

**File:** `modules/components/src/Button/index.tsx` (`BaseButton = withTooltip(styled('button', {...`)
**Severity:** medium
**Kind:** bug (compat-risk)
**Issue:** `BaseButton` is `styled('button', ...)` with no `type` prop set, and neither `Button` nor `TransparentButton` ever passes a default. Per the HTML spec, a `<button>` with no `type` attribute defaults to `type="submit"`. Confirmed by grep: `type="button"` appears nowhere in the entire `modules/components/src` tree. Every interactive control built on this shared base (`SQONViewer`'s Clear/Value/LessOrMore bubbles, `Pagination`, `ColumnsSelectButton`, `DownloadButton`, `ToggleButton`, `TermAggs`'s select-all/collapse/filter/sort icons) is therefore a `type="submit"` button. If any consumer ever renders Arranger's UI inside an HTML `<form>` (not an unusual integration pattern for a portal page), clicking any of these controls submits that form and potentially triggers a full navigation/reload, a silent and hard-to-diagnose failure for the integrator.
**Fix:** Default `type="button"` on `BaseButton` (or explicitly `type={props.type ?? 'button'}` in `Button`/`TransparentButton`), matching the general React/HTML best practice of never leaving `type` implicit on a non-submit button.
**Standalone:** yes.

### `Arranger/Table.jsx` is dead code with a broken import to a module that doesn't exist

**File:** `modules/components/src/Arranger/Table.jsx:3` (`import DataTable, { ColumnsState } from '#DataTable/index.js';`)
**Severity:** low
**Kind:** dead-code (broken import)
**Issue:** `#DataTable/index.js` resolves to `src/DataTable/index.js`, but no `DataTable` directory exists anywhere in `modules/components/src`. The file's only reference anywhere is a commented-out export in `Arranger/index.js` (`// export { default as OldTable } from './Table';`); nothing imports or renders it. It currently causes no build failure only because `tsconfig.release.json` sets `"noCheck": true` (with its own "remove once we're fully TSd" TODO) and no typecheck gate exists yet for this module (roadmap Phase 1.2 is not done). The moment either lands, this file fails to compile.
**Fix:** Delete `Arranger/Table.jsx`, or if intentionally kept as a stepping stone like the already-tracked `LiveAdvancedFacetView`/`MatchBoxState` pair, fix the import before any future typecheck gate lands rather than leaving it undiscovered.
**Standalone:** yes.

### `DatesAgg.jsx`'s `maxDate` becomes a plain number instead of a `Date` on the default (non-`enforceStatsMax`) path

**File:** `modules/components/src/aggregations/DatesAgg.jsx:29-33`
**Severity:** low
**Kind:** type-safety / bug
**Issue:** `const maxDate = enforceStatsMax ? statsMax : Math.max(Date.now(), statsMax);`. `Math.max` coerces both operands via `valueOf()`, confirmed directly that `Math.max(Date.now(), someDateObject)` returns a plain `number`, not a `Date`. So on the default path (`enforceStatsMax` unset/false), `maxDate` is a raw timestamp, while on the `enforceStatsMax: true` path it's a real `Date`, the same state field has a different runtime type depending on a boolean prop, then gets spread directly into two `<DatePicker minDate maxDate>` props. Verified this most likely doesn't crash today (date-fns v2's `toDate()`, used internally by `react-datepicker`'s comparisons, accepts a timestamp interchangeably with a `Date`), but it's a genuine type inconsistency that will surface the moment this file is converted to TypeScript, and is fragile if `react-datepicker` ever calls a native `Date` method on `maxDate` directly.
**Fix:** Wrap in `new Date(Math.max(Date.now(), statsMax))` so `maxDate` is always a `Date` regardless of branch.
**Standalone:** yes.

### `TermAggs`'s bucket checkbox has no `onChange`/`onClick` of its own; relies entirely on a wrapping `<div>`'s `onClick` and native event bubbling

**File:** `modules/components/src/aggregations/TermAggs/TermAggs.jsx:120,399-432,441-455`
**Severity:** low-medium
**Kind:** bug (a11y-adjacent)
**Issue:** Each facet bucket row is a native `<div onClick={...}>` (no `role`, no `tabIndex`, no `onKeyDown`) wrapping an `<input type="checkbox" readOnly checked={...} .../>` with no `onChange`/`onClick` of its own (`readOnly` has no defined effect on a checkbox per the HTML spec; its only real purpose here is suppressing React's uncontrolled-input warning). Toggling depends entirely on a mouse click bubbling to the row's `onClick`, or a keyboard user tabbing to the (natively focusable) checkbox and pressing Space, which also bubbles. This is an implicit, undocumented reliance on native bubbling rather than an explicit handler contract, and a real regression risk: any future change adding `stopPropagation` to the checkbox, or swapping the wrapping element for a non-bubbling one, would silently break keyboard interaction with no test to catch it (no rendering-level test coverage exists in this module, see the entry above).
**Fix:** Add an explicit `onChange`/`onClick` directly on the `<input>` calling the same handler logic, rather than relying on bubbling from a plain, non-interactive `<div>`.
**Standalone:** yes.

### `ThemeProvider`'s JSDoc for `theme` omits the processor-function form

**File:** `modules/components/src/ThemeContext/index.tsx:94-97` (JSDoc) vs. `ThemeContext/types/index.ts:26,54,57` (`CustomThemeType<Theme> = RecursivePartial<Theme> | ThemeProcessorFn`)
**Severity:** low
**Kind:** docs-drift
**Issue:** The JSDoc only documents `theme` as a plain object; it doesn't mention `theme` can also be a function `(baseTheme) => partialTheme`, a real, actively-handled case (`useThemeContext`'s explicit `typeof customTheme === 'function'` branch). Unlike the `DownloadButton`/`Aggregations` cases, the TypeScript type itself is accurate, so this is purely a prose-comment gap for a reader who doesn't cross-reference the type.
**Fix:** Extend the JSDoc to mention the function form and its purpose (composing with the outer/base theme).
**Standalone:** yes.

### Aggs-family handler naming inconsistency, flagged via an in-code TODO, never tracked

**File:** `modules/components/src/aggregations/aggComponentsMap.jsx:9-12`
**Severity:** low
**Kind:** docs-drift (internal-only)
**Issue:** An unresolved TODO reads: "also, what's with all the missmatching methods!? Fix it, Justin! // e.g. onValueChange vs HandleDateChange vs handleChange vs handleValueClick". Confirmed real: `composedBooleanAggs`/`composedTermAgg` use `handleValueClick`, `composedDatesAgg` uses `handleDateChange`, `composedRangeAgg` uses `handleChange`, all funnelling into the single public `Aggregations.onValueChange` callback (already tracked above). Purely internal, none of these are exported from the package's public `src/index.ts`, so not a consumer-facing gap, but worth a record so the TODO isn't the only trace of it.
**Fix:** Low priority; worth resolving alongside the "Components module modernization" pass rather than urgently.
**Standalone:** yes.

### The Jest suite only ever runs against `dist/`; every test in `src/` is silently never collected

**File:** `modules/components/jest.config.ts:6-7` (`modulePathIgnorePatterns: ['src', '.wireit']`)
**Severity:** high
**Kind:** false confidence
**Issue:** `modulePathIgnorePatterns` excludes any path *containing* the substring `src`, which is every source test in the package. Confirmed with `npx jest --listTests`: it returns exactly 10 paths, all under `dist/`. Overriding the pattern on the CLI makes Jest discover all 20 (10 source + 10 compiled), proving the `'src'` entry is the cause. Consequences, all live: the 59 passing tests assert against Babel output from the last build rather than current source; a test added to `src/` is silently not collected, reporting nothing rather than an error; a test deleted from `src/` keeps passing from its stale `dist/` copy until a clean rebuild; and the root `npm test` has no build dependency, so the code under test is whatever `dist/` happens to hold (only `turbo run test` rebuilds first, via `test.dependsOn: ["build"]`). The `'src'` entry predates the in-file comment above it, which explains only the `.wireit` entry.
**Fix:** Remove `'src'` from `modulePathIgnorePatterns` and exclude the build output instead: `testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.wireit/']`. Then stop Babel copying `.test.*` into `dist/` at all (`--ignore` on the build invocation), which also stops 16 test artifacts shipping in the tarball.
**Standalone:** yes, though expect the newly-collected source tests to need fixing; they have never run in their current form.

### `AggsWrapper` is exported from the public entrypoint and does not exist

**File:** `modules/components/src/index.ts:1`; `modules/components/src/aggregations/index.ts`
**Severity:** high
**Kind:** bug (phantom export)
**Issue:** `src/index.ts:1` re-exports `AggsWrapper` from `./aggregations/index.js`, which exports no such symbol (confirmed by grep: the name appears in `src/index.ts` and nowhere else in the package's source). Babel emits a live getter regardless, so at runtime the export resolves to `undefined` rather than throwing, and it appears in the package's public type surface. The only real `AggsWrapper` in the tree is a private one-line helper duplicated inside `AdvancedSqonBuilder/filterComponents/BooleanFilter.jsx` and `TermFilter.jsx`, never exported; the commented-out line in `Arranger/index.js` shows where the public one used to come from.
**Fix:** Remove `AggsWrapper` from `src/index.ts:1`. Then extend `integration-tests/import` to iterate every key of each imported namespace and assert none is `undefined`, which turns this whole class of defect into a test failure. That same assertion would also catch the `arranger-types` ESM gap logged under `## modules/types`.
**Standalone:** yes.
**FIXED 2026-08-17.** Removed from `src/index.ts`; rebuilt and confirmed absent from both `dist/index.js` and `dist/index.d.ts`. The suggested namespace-wide `undefined` assertion in `integration-tests/import` is still worth adding, and would also catch the `arranger-types` ESM gap.

### Nine runtime `dependencies` are never imported, and three of them are the package's production security findings

**File:** `modules/components/package.json` (`formik`, `react-grid-layout`, `react-scrollbar-size`, `react-toastify`, `react-treeview`, `resolve-url`, `rxjs`, `semantic-ui-css`, `semantic-ui-react`)
**Severity:** high
**Kind:** dependency hygiene / vulnerability
**Issue:** All nine are in `dependencies`, so every consumer of the published package installs them, and none appears anywhere in source or in the built `dist/` (verified by grep against both). Three of them (`react-scrollbar-size`, `react-toastify`, `semantic-ui-react`) are the source of high-severity production advisories and are the sole reason `fbjs`, `glamor`, `react-event-listener`, `isomorphic-fetch`, and `node-fetch@<2.6.7` are in the production tree at all; they also pull both `core-js@2` (npm-deprecated) and `core-js@1`. `resolve-url` carries its own npm deprecation notice and was last published in 2014. Four of the nine additionally advertise React peer ranges that do not include React 18, so removing them shortens the React 19 path tracked under the modernization item.

This is the inverse of the phantom-dependency audit, which looked only for imported-but-undeclared. Declared-but-unused was never checked, and it is where the production risk actually sits.
**Fix:** Delete all nine from `dependencies`; no code changes are required. Re-run `npm audit --omit=dev` afterwards to record the new production baseline. `recompose` stays until the tracked React 19 work removes it. The equivalent sweep found five more in `modules/graphql-router` (`chalk`, `dotenv`, `morgan` + `@types/morgan`, `graphql-playground-html`, `graphql-playground-middleware-express`), where removing `morgan` also drops a production moderate from the published library while leaving `apps/search-server`'s legitimate use untouched.
**Standalone:** yes.

---

## modules/types

### No unit tests for `networkAggregationConfigUtils`, and its two exports turned out to be unused, not just untested

**Files:** `modules/types/src/configs/networkAggregationConfigUtils.ts`
**Severity:** low
**Kind:** missing test coverage
**Correction (2026-08-17):** this entry previously also named `modules/types/src/tools/typeFns.ts`. Current `typeFns.ts` (5 lines) contains only two compile-time-only type aliases (`Prettify<T>`, `ValuesOf<T>`), no runtime functions at all; "co-located unit tests covering each exported function" isn't actionable for it, a `node:test` test can't exercise a type alias. Dropped from this entry.
**Issue:** `networkAggregationConfigUtils.ts` contains non-trivial domain logic for network aggregation config setup and has zero test coverage. Separately, and worse than "untested": its two exports, `isLocalNode`/`isRemoteNode`, are exported publicly (via `configs/index.ts`) but have zero call sites anywhere in the monorepo, not even within `modules/types` itself, and not in `graphql-router`'s network code, the natural consumer, which instead does its own inline `localConfig.catalogId` access without ever using these guards.
**Fix:** Either wire `isLocalNode`/`isRemoteNode` into `graphql-router`'s network node handling (where local/remote discrimination actually happens today via ad hoc property access), or remove them if there's no near-term consumer, rather than carrying an untested, unused public export.
**Standalone:** yes

### Config constants need reorganization (blocked on architecture work)

**File:** `modules/types/src/configs/constants.ts`
**Severity:** medium (grows over time as configs accumulate)
**Kind:** design-smell
**Issue:** The constants file itself has a TODO at line 1 acknowledging the problem: the dependency tree between server-level and catalog-level configs isn't clearly expressed. Currently, "catalog-level" conflates Arranger core config and GraphQL transport config, because those two things are coupled in the current architecture. This is _intentionally_ coupled; the design is accurate to how the system works today. But it means the constants structure will need to be rethought once the Arranger core module is extracted and the transport coupling dissolves.
**Fix:** Reorganize into at least three layers (server-level global, transport-level GraphQL-specific, and core-level engine/search config) once the core module boundary is defined. Attempting this before that extraction would be premature.
**Standalone:** no; blocked on the Arranger core module extraction in the roadmap

### `NetworkConfig.localNode` doesn't support local multicatalogue

**File:** `modules/types/src/configs/index.ts` (`NetworkConfig`, existing `// TODO: To support multi-catalogue, we need to update this to be 'localNodes': LocalNodeConfig[]` comment)
**Severity:** medium (blocks federating from a multicatalogue-mode server; this feature and multicatalogue support are currently unaligned efforts)
**Kind:** missing feature
**Issue:** `NetworkConfig.localNode` is typed as a single `BaseNodeConfig`, not an array, so a server running in multicatalogue mode can't expose more than one of its own local catalogues into a network/federated query. This is a `modules/types` issue (the config type itself), with side effects in `graphql-router` (`createSchemaFromNetworkConfig`/`aggregationPipeline` need to consume the new shape) and a dependency the other way in `modules/components`: see `.dev/docs/components-multicatalogue.md` for the parallel client-side multicatalogue work this needs to stay aligned with.
**Fix:** Change to `localNodes: LocalNodeConfig[]` as the existing TODO already specifies, and thread the array through wherever config is assembled into `createSchemaFromNetworkConfig`. `aggregationPipeline` itself already accepts `localNodes` as an array in its own signature, so the remaining gap is specifically the config type and its loading path, not the pipeline.
**Standalone:** no; coordinate with the Components multicatalogue work so both sides land with a consistent mental model of what identifies a local catalogue

### `esToAggTypesMap` silently omits real ES/OS field types instead of explicitly filtering them, the way `'nested'` already is

**File:** `modules/types/src/elastic/constants.ts:1-17`
**Severity:** medium
**Kind:** bug
**Issue:** `esToAggTypesMap` covers 15 keys. `field.type` is read directly off the live ES/OS mapping's raw `type` string, so it can legitimately be any real ES/OS field type, `short`, `ip`, `geo_point`, `geo_shape`, `date_nanos`, `flattened`, `token_count`, any `*_range` type, none of which appear in the map. Unlike `'nested'`, which every consumer explicitly filters out before the lookup, these other uncovered types are not filtered, so `esToAggTypesMap[field.type]` silently evaluates to `undefined`, which flows into the generated GraphQL SDL as a field/aggregation `type: undefined`, with no compile-time protection in either consuming file.
**Fix:** Either add the missing ES/OS types with an explicit aggregation-type mapping, or add an explicit "known non-aggregatable type" filter mirroring the existing `'nested'` handling, so unmapped types are deliberately excluded rather than silently propagating `undefined`.
**Standalone:** yes.

### `modules/types/README.md`'s usage example throws at runtime as written

**File:** `modules/types/README.md:28`
**Severity:** medium
**Kind:** docs-drift
**Issue:** `import { ES_TYPES } from '@overture-stack/arranger-types/elastic';`, but `ES_TYPES` is a type-only export (`export type ES_TYPES = keyof typeof esToAggTypesMap;`) with no runtime binding. Confirmed by running the exact statement against the built package: `SyntaxError: The requested module '.../modules/types/dist/elastic/index.js' does not provide an export named 'ES_TYPES'`. `tsc` elides a type-only import like this automatically, but any per-file transpiler (esbuild/swc/Babel/tsup, and tsup is what this monorepo itself uses to build several of its own packages) won't, and Node's strict ESM loader throws exactly as reproduced.
**Fix:** Change the example to `import type { ES_TYPES } from '@overture-stack/arranger-types/elastic';`.
**Standalone:** yes.

### Minor: raw `console.error` instead of structured logging

**File:** `modules/types/src/tools/stringFns.ts:28`
**Severity:** low
**Kind:** docs-drift (convention outlier)
**Issue:** `stringToArray`'s catch block does `console.error('Issue in types/stringToArray\n', err)`, the only `console.*` call in the package. Minor outlier in an otherwise side-effect-free, framework-agnostic utility module, given this repo's structured-logging convention.
**Fix:** Either drop the log entirely (the function already returns a safe fallback) and let the caller decide whether/how to log, or accept an optional logger callback param. Low priority, flagging for awareness only.
**Standalone:** yes.

### The package's own types promise 29 symbols its ESM build does not export

**File:** `modules/types/src/index.ts:3` (`export * from './sqon.js'`); `modules/types/dist/index.js` vs `dist/index.cjs` vs `dist/index.d.ts`
**Severity:** high
**Kind:** bug (dist/src mismatch, ESM only)
**Issue:** `src/index.ts` re-exports everything from `@overture-stack/sqon`. tsup emits that correctly for CJS and drops it from ESM. Confirmed by execution:

- CJS: `require('dist/index.cjs')` returns 31 keys including `SqonBuilder`, `SqonSchema`, `addFilterClause`, `SQON_SCHEMA_VERSION`.
- ESM: `import('dist/index.js')` returns exactly 2 keys, `configs` and `elastic`.
- Types: `dist/index.d.ts` contains `export * from '@overture-stack/sqon'`, so TypeScript resolves all 29 into the public surface.

Verified end to end that the types and the ESM runtime disagree: a file doing `import { SqonBuilder } from '@overture-stack/arranger-types'` **typechecks clean** against the published declarations, and the same import at ESM runtime yields `undefined`. Silent `undefined` when destructured, not a throw. ESM is the majority case for new integrations, so the failing half is the more common one. The generated ESM does build the re-export into a local object (`__reExport(src_exports, sqon_exports)`) but the emitted `export { ... }` statement lists only `configs` and `elastic`.
**Fix:** Replace the bare `export * from './sqon.js'` with an explicit named re-export list (tsup handles named re-exports correctly in both formats), or drop the root SQON re-export entirely and have consumers depend on `@overture-stack/sqon` directly. Add an ESM-condition smoke test asserting `Object.keys(await import(...))` matches the declared export list; the same test catches the `AggsWrapper` phantom export logged under `## modules/components`.
**Standalone:** yes.

### No `imports` field, despite the source using `#`-prefixed subpath specifiers

**File:** `modules/types/package.json` (no `imports` key); `modules/types/src/configs/index.ts:4` (`import type { ValuesOf } from '#tools/typeFns.js'`); `modules/types/tsconfig.json:13`
**Severity:** medium
**Kind:** config drift
**Issue:** Every other package that uses `#` specifiers declares a matching `imports` map (`sqon`, `graphql-router`, `components`, `charts`, both apps). `modules/types` declares the alias only in `tsconfig.json`'s `paths`, so it resolves under `tsx` and under esbuild-via-tsup (both of which honour tsconfig `paths`) but not under Node's own resolver: running `node -e "import('#tools/typeFns.js')"` from the package directory fails with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. Inert today because nothing uses native resolution for this package, and a live hazard for the pnpm migration, where resolution paths shift.
**Fix:** Add `"imports": { "#*": "./src/*" }`, matching `modules/sqon` exactly. Costless.
**Standalone:** yes.
**FIXED 2026-08-17.** Added `"imports": { "#*": "./src/*" }` matching `modules/sqon`. Verified the alias resolves under `tsx` (the real runtime); build and all 29 tests pass, as do `sqon`'s 125.

---

## monorepo: cross-cutting

### Inconsistent unit test file placement

**File:** throughout the monorepo
**Severity:** low (consistency / maintainability)
**Kind:** convention drift
**Issue:** Unit test files follow two competing patterns across the monorepo:

- **(A)** `__tests__/validation.test.ts` in a sibling `__tests__` folder; risks accidentally centralizing all tests for a module at a parent or root level as the codebase grows
- **(B)** `validation.test.ts` co-located in the same folder as the file under test; tighter, follows a barrel/module pattern where each unit's test travels with it

The preferred pattern is **(B)**. Mixing the two makes it harder to find tests, harder to enforce coverage, and easier for tests to drift away from the code they cover.
**Fix:** Audit the monorepo and move all `__tests__/` test files to be co-located with their source file, following pattern (B). Update any Jest/node:test config glob patterns that rely on `__tests__/` directory discovery.
**Standalone:** yes; mechanical file moves plus config glob updates, no logic changes

### Elasticsearch-first naming in startup script and env vars

**Files:** `scripts/ping-elasticsearch.sh`; env vars `ES_HOST`, `ES_USER`, `ES_PASS` set by the chart
**Severity:** low (misleading branding; confusing for operators using OpenSearch)
**Kind:** terminology / naming
**Issue:** The startup readiness script is named `ping-elasticsearch.sh` and prints "Elasticsearch Ready" regardless of the configured engine. The env vars exposed by the chart (`ES_HOST`, `ES_USER`, `ES_PASS`) carry the "ES" prefix even when connecting to OpenSearch. The display label in the script has been updated to derive from `SEARCH_ENGINE` (outputs "OpenSearch", "Elasticsearch", or "Search Engine"), but the script filename and chart env var names remain Elasticsearch-first.
**Fix:** Rename `ping-elasticsearch.sh` to `ping-search-engine.sh` (or `ping-cluster.sh`) and update the reference in the Dockerfile/entrypoint. Coordinate with the chart to rename `ES_HOST`, `ES_USER`, `ES_PASS` to engine-neutral names (`SEARCH_HOST`, `SEARCH_USER`, `SEARCH_PASS` or similar). Both changes require a coordinated release since the chart and image must agree on env var names.
**Standalone:** no; script rename is trivially standalone, but env var rename requires a matching chart release

### `make start-os` and `make start-server` reference docker-compose services that don't exist

**File:** `Makefile` (`start-os`, `start-server` targets); `docker-compose.yml`
**Severity:** low (local dev/demo convenience only; no production or CI impact)
**Kind:** stale / broken tooling
**Issue:** `make start-os` runs `$(DC_UP_CMD) opensearch`, but `docker-compose.yml` defines no `opensearch` service at all; only `elasticsearch`, `kibana`, `server`, and `ui` exist. The target fails outright. Separately, `make start-server` runs `$(DC_UP_CMD) arranger-server`, but the compose service key is `server` (its `container_name` is `arranger-server.local`, easy to confuse with the service key itself); that target is broken the same way.
**Fix:** Add an `opensearch` service to `docker-compose.yml`. Starting OpenSearch is functionally the same process as the existing `elasticsearch` service (single-node container, health check against `_cluster/health`, same 9200/9300 ports), so the two definitions should stay nearly identical: swap the image (`opensearchproject/opensearch` for `docker.elastic.co/elasticsearch/elasticsearch`) and reconcile whatever security-plugin config differs (OpenSearch's security plugin vs. ES's `xpack.security`/`ELASTIC_PASSWORD` env vars). Fix the `start-server` service-name mismatch (`arranger-server` to `server`) in the same pass.
**Standalone:** yes for both fixes as stated; coordinate with [OpenSearch-first migration](roadmap.md#opensearch-first-migration) if that work also changes which engine `make start` brings up by default, since this item only makes `start-os` work, not necessarily the default.

### Audit public exports across all modules for spurious entries

**Files:** `modules/sqon/src/index.ts`, `modules/graphql-router/src/index.ts`, `modules/types/src/index.ts`, `modules/components/src/index.ts`, `modules/charts/src/index.ts`
**Severity:** low (API surface hygiene; no functional impact)
**Kind:** API cleanliness
**Issue:** Some exports in `modules/sqon` were added in anticipation of planned consumers (MCP handler) that don't exist yet. Across all modules, there may be exports that were added for one-off use, left over from refactors, or added speculatively. Unexported internals are easier to change without breaking callers; a clean public API surface is a forcing function for good module boundaries.
**Fix:** For each module's `index.ts`, grep all exported names against imports across the monorepo. Remove exports with no consumer outside the module, or demote them to internal. Verify each removal does not break integration-tests or external packages (`sqon-builder` deprecation may affect this for `modules/sqon`).
**Standalone:** yes; one module at a time; `modules/sqon` is the most active and a good starting point

### Inconsistent spelling of `catalogue`

**File:** throughout the monorepo
**Severity:** low (consistency / maintainability)
**Kind:** terminology drift
**Issue:** As discussed in https://github.com/overture-stack/admin/issues/182 , we have chosen the Canadian spelling `catalogue` over the American `catalog`.

**Already renamed to `catalogue`:** all internal-only code (variables, internal function/type names, comments) and doc prose across `apps/search-server`, `apps/mcp-server`, `modules/graphql-router`, `modules/types`, and `integration-tests` use the `catalogue` spelling, with one deliberate exception (next paragraph). `CatalogsMap` is already `CataloguesMap` (`apps/search-server/src/configs/types/index.ts`), contrary to what an earlier version of this entry said; re-verified 2026-08-04, not still pending.

**One root identifier kept as `catalogs` on purpose, not an oversight:** the parameter/variable holding a `CataloguesMap` value is named `catalogs` everywhere it's passed through (`arrangerRoutes.ts`, `server.ts`, `introspection/index.ts`, `serverDetails.ts`, and now `catalogues/findCatalogueByIdentifier.ts`), even though everything derived from it locally (`catalogueEntries`, `catalogueIds`, `catalogueRouters`, `catalogueStatuses`) already uses the correct spelling. This isn't inconsistent by accident: that same value is what `serverDetails.ts` ultimately serializes under the still-unrenamed `catalogs` JSON key (next paragraph), so the variable name matches the contract it flows into end to end. Renaming just the variable while the JSON key stays `catalogs` would be the actually-inconsistent state, not this one.

**Remaining, deliberately not renamed (external contract surface, needs a coordinated/breaking change, not a text pass):**
- `catalogId` / `CatalogId` / `CATALOG_ID`: the config JSON key (`base.json`), the route param, and the GraphQL/introspection field. Defined once at `modules/types/src/configs/constants.ts:4`.
- `catalogs` and `catalogCount` as literal introspection response keys (as opposed to the same words used generically in prose, which are already renamed). The internal `catalogs` variable above flows straight into this key; renaming one without the other isn't meaningful.
- `CatalogFieldIntrospection`, `CatalogIntrospectionResponse`: exported types from `apps/search-server/src/introspection/types.ts` that `apps/mcp-server` imports directly (via a raw cross-app file path, see the "Introspection types should be Zod-first" entry above), genuinely external, unlike `CatalogsMap` above.
- All real catalogue config JSON fixtures (`configTemplates/*.json`, `integration-tests/*/multiconfigs/*/base.json`) and the `configTemplates/configs.json.schema`: their keys are the config-file contract; renaming needs the same migration as `catalogId` above.
- `integration-tests/server/multiconfigs/catalog1`/`catalog2` directory names, inconsistent with `integration-tests/mcp-server/multiconfigs/catalogue-a`/`catalogue-b`, which already use the correct spelling. A filesystem rename, out of scope for a text-only pass.

**Fix:** when `catalogId`/`catalogs`/`catalogCount` are renamed (see the "Per-catalogue search engine credentials via env vars" and general API contract work in `roadmap.md`), accept both spellings during a deprecation window (config parser accepts either key; API dual-emits) before removing the old one. `apps/mcp-server` will need a matching update wherever it depends on introspection response shapes.
**Standalone:** the internal rename above was standalone and is done; the remaining contract rename is not standalone, and needs coordinated changes across `modules/types`, `apps/search-server`, `apps/mcp-server`, and any external consumer of the introspection API.

**Missed by the rename above, not decided against:**
- `apps/mcp-server/src/mcp/resources.ts`: the MCP resource URI template itself still reads `arranger://introspection/catalog/{catalogueId}`, "catalog" in the path segment, "catalogue" in the parameter name. The earlier mcp-server migration renamed the parameter but not the URI itself. Reflected consistently in `docs/mcp-server.md` and the mcp-server integration tests (`arranger://introspection/catalog/...`), so it's not just one file to fix, everywhere this literal string is read or asserted needs the same rename together. Since this is a URI an MCP client could reasonably treat as a stable identifier, treat as a coordinated rename rather than a quick fix; confirm no external client depends on the current path before changing it.

### `/download` route has no test coverage anywhere, unit or integration

**File:** `modules/graphql-router/src/download/index.js`; `integration-tests/server/test/spinupActive.js:137`
**Severity:** high
**Kind:** test-coverage
**Issue:** `/download` is a real mounted route, and both `integration-tests/server` and `integration-tests/mcp-server`'s server setups explicitly run with `disableDownloads: false`, i.e. the route is live in every integration test server instance. Despite that, no test anywhere exercises it: no co-located unit test for `download/index.js` or `dataToExportFormat.js` (only `dataToTSV.test.js`, a pure-function unit test one layer downstream), and `integration-tests/server/test/spinupActive.js:137` contains a literal `// TODO: add /download checks` that was never followed up. The download/export streaming path (headers, chunked writes, error handling) has zero coverage end to end. This sits directly upstream of the existing "Download route body is brittle" entry above (five separate fragility issues in the same file), the complete absence of any test is a plausible reason those issues went unnoticed long enough to be logged as debt rather than caught by a failing test. Also upstream of the `disableDownloads`/`disableFilters` gaps and the `mock`-flag and CSV-injection findings logged in the `graphql-router` section above, all in this same untested file.
**Fix:** At minimum, add an integration test that POSTs a real download request against a live-ES-backed server and asserts on the response body/headers; ideally also a unit test for `download/index.js`'s request-handling logic in isolation.
**Standalone:** yes.

### Only one of seven classified catalogue failure modes is integration-tested against a real cluster

**File:** `integration-tests/server/test/partialAvailability.test.ts`; `modules/graphql-router/src/searchClient/classifyCatalogueFailureReason.ts:2-10`
**Severity:** medium
**Kind:** test-coverage
**Issue:** `classifyCatalogueFailureReason.ts` defines seven error codes (`CONNECTION_ERROR`, `INDEX_NOT_FOUND`, `MAPPING_FETCH_ERROR`, `NESTING_PREFIX_NOT_FOUND`, `PERMISSION_DENIED`, `SCHEMA_BUILD_ERROR`, `UNKNOWN_ERROR`). `partialAvailability.test.ts`, the only end-to-end, real-ES exercise of the partial-availability/degraded-status mechanism, only ever produces `INDEX_NOT_FOUND`. The other six are exercised only via mocked `Error` objects in the classifier's own unit tests, never confirmed against how a real Elasticsearch/OpenSearch client actually shapes an auth failure, connection failure, or malformed-mapping response.
**Fix:** Extend the partial-availability suite with at least one additional real scenario (e.g. a catalogue pointed at wrong credentials, to exercise `PERMISSION_DENIED` against real ES auth rejection), confirming the real client error shape still matches what the classifier's mock-based unit tests assume.
**Standalone:** yes.

### `integration-tests/mcp-server` never exercises single-catalogue mode

**File:** `integration-tests/mcp-server/test/index.test.ts:166`; `apps/mcp-server/src/mcp/executeQueryTool.ts:264-266`
**Severity:** medium
**Kind:** test-coverage
**Issue:** `integration-tests/mcp-server` always starts Arranger with `catalogueConfigsPath: './multiconfigs'`, multicatalogue mode only. `executeQueryTool.ts` documents a real mode-dependent code path: `paths.graphql` is `"/graphql"` in single-catalogue mode vs. `"/:catalogueId/graphql"` in multicatalogue mode, derived server-side from the real Arranger server's introspection response. The MCP tool's own unit test verifies its *consumption* of a single-catalogue-shaped introspection payload via a hand-written mock, but nothing verifies that a real, live single-catalogue Arranger server actually produces that shape, nor exercises the full round-trip. `integration-tests/server`, by contrast, explicitly covers both modes with separate suites.
**Fix:** Add a single-catalogue suite to `integration-tests/mcp-server` mirroring `integration-tests/server`'s single-vs-multi split.
**Standalone:** yes.

---

## release / publishing

### The repo is AGPL-3.0 but no package declares a `license`, so all five published packages show none on npm

**File:** root `LICENSE` (AGPL-3.0, tracked since 2021); no `license` field in root `package.json`, `modules/{charts,components,graphql-router,sqon,types}/package.json`, or either `apps/*/package.json`
**Severity:** medium (higher for the client-side packages, see below)
**Kind:** packaging / licensing
**Issue:** Verified across all eight manifests: not one declares `license`. npm therefore renders all five published packages with no license, and `npm pack --dry-run` confirms no package ships a copy of the licence text either (each tarball is `README.md`, `dist/`, and `package.json`). This is worse than being unlicensed: the project genuinely *is* AGPL-3.0, a strong copyleft licence with real obligations, and the automated compliance gate that would flag it in a consumer's pipeline never fires because there is nothing to read. Arranger's consumers are exactly the institutional and clinical integrators most likely to run such gates.

Worth deciding rather than assuming: AGPL's network-use clause has materially different implications for `arranger-components` and `arranger-charts`, which are bundled into consumers' browser applications, than for the server packages. Whether the client-side packages are intended to carry the same licence is a real question, not a formatting detail.

**Confirmed as an oversight, not a deliberate position (2026-08-17):** surveying the sibling Overture clones, `lectern`, `js-lectern-client`, and `maestro` declare `AGPL-3.0`, while `lyric`, `sqon-builder`, and `website` declare `AGPL-3.0-or-later`. Only `arranger`, `stage`, `dms-ui`, `ego-ui`, and `dms-jbrowse-components` omit it. GitHub itself reports this repo correctly (`license.spdx_id: "AGPL-3.0"`, detected from the `LICENSE` file); it is only the npm packuments that carry nothing. **Sharpest instance:** `@overture-stack/sqon-builder` declares `AGPL-3.0-or-later` and `@overture-stack/sqon`, the package actively replacing it, declares nothing. A consumer who migrates on the project's own advice moves from a cleanly-licensed dependency to an unlicensed one, and their compliance tooling flags the migration as a regression. Fix `modules/sqon` before its next `rc` publish.

Separately, no copyright holder is asserted anywhere: `LICENSE` still carries the unfilled FSF boilerplate (`Copyright (C) <year> <name of author>`), no source file has a licence header, and `README.md` has no License section. `git log --follow` shows GPL v3 added 2018-01-08 and switched to AGPL 2018-02-05, untouched since.
**Fix:** Add `"license": "AGPL-3.0-or-later"` (matching the newer siblings' SPDX form, which is what the LICENSE's own "or any later version" boilerplate actually grants) to all five publishable packages, plus the two apps and the root for consistency. Settle the client-side question first for `components`/`charts` specifically, since declaring it will make the position visible to external integrators for the first time and is worth doing deliberately before the first non-`rc` `1.0.0`. Add a copyright line to `LICENSE` and a short License section to `README.md`.
**Standalone:** the three server-side packages are standalone and should not wait; `components`/`charts` need the client-side question answered first.

### `.turbo/turbo-build.log` included in published tarballs

**Files:** `modules/graphql-router`, `modules/components`; published npm tarballs
**Severity:** medium
**Kind:** packaging hygiene
**Issue:** Built tarballs for `graphql-router` and `components` include `.turbo/turbo-build.log`. Build logs are not part of the public package API and should not ship to consumers. Other internal artifacts (test fixtures, source files not in `dist`) may have the same problem.
**Fix:** Add `files` allowlists to `package.json` for each publishable module (explicitly listing `dist`, `README.md`, `package.json`), or add `.npmignore` rules to exclude `.turbo/`, `src/`, and any generated logs. Verify with a dry-run pack after fixing.
**Standalone:** yes; mechanical packaging fix per module, no logic changes

### `integration-tests/import` does not cover ESM-only publishable packages

**Files:** `integration-tests/import/test.ts`, `integration-tests/import/package.json`
**Severity:** low (gap in regression coverage)
**Kind:** missing test coverage
**Issue:** `integration-tests/import` runs under Jest + ts-jest, which handles CJS and TypeScript source but cannot import pure-ESM dist packages (`.js` files with `"type": "module"` and no `"require"` export) without additional configuration. `@overture-stack/arranger-graphql-router` is pure ESM and is missing from the import smoke test. `@overture-stack/arranger-types` (CJS + ESM hybrid), `@overture-stack/arranger-components` (CJS via Babel), and `@overture-stack/sqon` (dual ESM+CJS since 2026-06-30) are covered. An import regression in `graphql-router` would not be caught by this test.

Additionally: `integration-tests/import` resolves all deps via npm workspaces symlinks (`file:` paths), so it tests local build output, not the published tarball. Publishing regressions (e.g. stale `file:` refs in `package.json`) are caught by `npm run release:check` (`scripts/verify-pack.mjs`), not by this test.

**Fix:** Either configure Jest to handle pure-ESM packages (update `transformIgnorePatterns`, enable `--experimental-vm-modules`), or add a separate lightweight smoke test using `node --input-type=module` or `tsx` that imports from `arranger-graphql-router` and checks its key exports.

**Additional TODOs on top of the ESM gap:**

1. **Verify `exports` subpaths, not just package root.** The smoke test should assert each named subpath in the `exports` field (`./utils`, `./download`, etc.) resolves and exposes the expected named exports. A missing barrel re-export (e.g. `getAllData` was absent from `utils/index.ts`) causes `ERR_PACKAGE_PATH_NOT_EXPORTED` for consumers importing via a subpath, which the current test would not catch.
2. **Document what is exported and why.** There is currently no reference for which methods are available on each export path (`./utils`, `./download`, root) or what they are for. Add inline JSDoc to each export in the barrel files and a brief summary in the package README (once one exists; see search-server README debt) or a `EXPORTS.md` at the package root.

**Standalone:** yes; test infrastructure change only, no application code

### `file:` local dependencies in publishable packages

**Files:** `modules/types/package.json`, `modules/graphql-router/package.json`, `modules/components/package.json`
**Severity:** high (confirmed consumer-facing breakage)
**Kind:** packaging bug
**Issue:** Three publishable packages reference sibling packages via `file:` paths in `dependencies` (e.g. `"@overture-stack/arranger-types": "file:../types"`). npm encodes these verbatim in the published tarball's `package.json`. External consumers get errors like `Package "" refers to a non-existing file '"/Users/.../types"'` because the publishing machine's local paths do not exist in the consumer's environment. `modules/sqon` and `modules/charts` are clean; no `file:` deps.

**Interim fix (implemented):** `scripts/fix-workspace-deps.mjs` rewrites `file:` deps to `^<sibling-version>` ranges before each `npm publish` call in the Jenkins pipeline, then restores `package.json` from git. Local dev is unchanged; `file:` refs continue to work via npm workspaces symlinks. The pipeline publish loop calls the script and restores after each package. Note: alphabetical publish order (`components` and `graphql-router` before `types`) means there is a short window where those packages reference a `types` version not yet on npm. Acceptable for coordinated release runs; Changesets eliminates it by publishing in dependency order.

**Confirmed still live on npm (2026-07-28):** `npm view @overture-stack/arranger-types dependencies` shows `"@overture-stack/sqon": "file:../sqon"` verbatim on both the `latest` and `rc` dist-tags, blocking any external install (surfaced while diagnosing an argo-platform bundling failure that traced back through `arranger-components@rc` -> `arranger-types@rc` -> this). The currently-published tarball predates the interim fix actually running clean, or a step in the publish loop silently didn't apply it that run. A fresh publish through the current pipeline should resolve it without further code changes; worth confirming the publish log actually shows the rewrite step running before assuming a clean republish will fix it.

**Long-term fix: two separate tools, both needed:**

- **Changesets (roadmap Phase 3.1):** Handles version management, changelog generation, and publishing in dependency order. Replaces the manual version-bump commit and the current pipeline publish loop. Does not on its own solve the `file:` encoding problem, but it handles it as part of its version-replacement step when combined with pnpm.

- **pnpm workspace: protocol (roadmap Phase 3.3):** Replaces `file:../x` deps with `workspace:*`. In development, pnpm resolves `workspace:*` to the local package (same behaviour as `file:`). At `pnpm publish`, pnpm automatically rewrites `workspace:*` to the actual version range in the tarball. This eliminates the problem at the package manager level, making the fix-and-restore script unnecessary.

**When Changesets lands (Phase 3.1):** Delete `scripts/fix-workspace-deps.mjs` and remove the `node scripts/fix-workspace-deps.mjs` and `git checkout` lines from the Jenkins publish loop. Changesets' `changeset version` step rewrites `file:` deps to real version ranges before publishing, making the interim script redundant. `scripts/verify-pack.mjs` stays.

**When pnpm lands (Phase 3.3):** Replace all `file:../x` dep specs with `workspace:*` across every `package.json` in the repo (publishable modules, `apps/`, `integration-tests/`). pnpm replaces `workspace:*` with real version ranges at publish time automatically. `scripts/verify-pack.mjs` already handles this; no changes needed there.

**Standalone:** no; depends on Changesets (Phase 3.1) for the clean fix; pnpm (Phase 3.3) for the workspace: migration.

### `modules/graphql-router` reads `process.env` directly, breaking the module/app boundary

**File:** `modules/graphql-router/src/mapping/resolveHits.js:164` (`systemCores = process?.env?.SYSTEM_CORES || 2`, a default parameter value on `hitsToEdges`)
**Severity:** low (works today; a latent boundary violation, not a live bug)
**Kind:** architecture violation
**Issue:** Established convention: apps read `process.env`, modules receive typed params (see [[feedback_separation_of_concerns]] in project memory). `hitsToEdges` is the sole exception, reading `SYSTEM_CORES` straight from the environment instead of accepting it as a parameter. `SYSTEM_CORES` doesn't appear anywhere else in the codebase, not in `apps/search-server/.env.schema`, not in any `configOptionalProperties`, not threaded through as an explicit argument by `resolveHits.js`'s own default export when it calls `hitsToEdges` internally, so this isn't just an internal-vs-external-config style choice, it's an undocumented, unwired env var a deployer has no way to discover short of reading this one line of module source.
**Fix:** Add `SYSTEM_CORES` to `apps/search-server/.env.schema` and `configOptionalProperties`, read it once at the app layer the same way every other env-derived config value is, and pass it into `hitsToEdges` as an explicit `systemCores` parameter from `resolveHits.js`'s default export, dropping the `process.env` read from the module entirely.
**Standalone:** yes; small, self-contained wiring fix, no behavioural change to the "ludicrous mode" chunking logic itself

### Multicatalogue boot logs interleave mid-block between unrelated catalogues

**File:** `modules/graphql-router/src/router.ts`, `graphqlRoutes.ts`, `searchClient/fetchMapping.ts`, `config/utils/index.ts` (every per-catalogue boot-log call site)
**Severity:** low (cosmetic; doesn't affect behaviour, only how readable the boot log is)
**Kind:** logging design gap
**Issue:** Catalogues load concurrently (`Promise.allSettled` in `apps/search-server/src/arrangerRoutes.ts`), and each catalogue's boot sequence is many separate `console.log`/`console.error` calls spread across several `await` points. Node's event loop is free to run a different catalogue's own pending print statements in the gaps between any two of them, so one catalogue's output can land in the middle of another's, confirmed directly: a multi-line error dump's closing brace for one catalogue immediately followed by an unrelated catalogue's own progress line, with no boundary between them. Labelling each divider with its catalogue name (`------ donor ------`) helps identify which block a line belongs to, but doesn't stop unrelated blocks from butting up against each other, since a single `console.log` call is atomic but the many separate calls making up one catalogue's whole sequence are not.
**Fix:** Buffer each catalogue's own boot output (every `console.log`/`console.error`/`console.debug` call currently scattered across its `await`s) into a single string or array, and flush it with one `console.log`/`console.error` call once that catalogue's startup finishes, success or failure. Preserves concurrency (catalogues still load in parallel, no startup slowdown) while guaranteeing each catalogue's own block prints as one uninterrupted chunk; different catalogues' blocks can still land in any order relative to each other, just never interleaved inside one another.
**Standalone:** no; touches every per-catalogue boot-log call site across four files, needs a small shared buffering helper rather than four independent fixes
