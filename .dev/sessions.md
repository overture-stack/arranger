# Session Log

Brief record of what was done each session, key decisions made, and any open threads.
Not a changelog; that's git. This captures context and decisions that don't live in code.
Newest first.

---

## 2026-07-01

Began sqon-builder deprecation: confirmed the unscoped `sqon-builder` dep in components was never imported and removed it; added deprecation notice to the `@overture-stack/sqon-builder` README; documented the absorption rationale and design decisions in the sqon module.

- `modules/components/package.json`: removed `sqon-builder` (dead dependency - was listed at `^2.0.1` but never imported anywhere in the source)
- `overture/sqon-builder/README.md`: added prominent deprecation notice at the top pointing consumers to `@overture-stack/sqon`
- `modules/sqon/docs/sqon-builder-absorption.md`: new file recording what was absorbed, why, and key design decisions (type boundary, `& SQON` anti-pattern fix, full operator coverage, what was not ported)
- `.dev/roadmap.md`: condensed the sqon-builder absorption section to just the remaining step (publish deprecation version, run `npm deprecate`)

---

## 2026-06-30

Absorbed `@overture-stack/sqon-builder` functionality into `modules/sqon`, making it the single package for SQON construction and validation; `sqon-builder` is now redundant and will be deprecated separately.

- `modules/sqon/src/schema/constants.ts`: added `zod.boolean()` to `SqonScalarValueSchema`; exported `SqonScalar` and `SqonScalarOrArray` types
- `modules/sqon/src/schema/index.ts`: re-exported the two new types
- `modules/sqon/src/builder/utils.ts`: new file - `SqonFieldFilter` type, `isGroupNode`, `isFieldFilter`, `asArray`, `emptySqon`, `checkMatchingArrays`, `checkMatchingFilter`; `SqonFieldFilter` defined as `SqonNode & { content: { fieldName: string; value: SqonScalarOrArray } }` so it satisfies the type predicate constraint
- `modules/sqon/src/builder/reduce.ts`: new file - `reduceSqon`; merges in/not-in/some-not-in/all value arrays, applies boundary semantics to gt/gte/lt/lte, removes empty combinations, unwraps single-item and/or (except pivoted ones), flattens same-op same-pivot combinations; `between` intentionally left non-reducible (v2)
- `modules/sqon/src/builder/index.ts`: new file - `SQON` factory and `SqonBuilder` type; covers `in`, `not-in`, `some-not-in`, `all`, `gt`, `gte`, `lt`, `lte`, `between`, `fuzzy` (op stays `'filter'` for serialized SQON compatibility), `and`, `or`, `not`, `setFilter`, `removeFilter`, `removeExactFilter`; builder is a pure wrapper over `SqonNode`, not the `& SQON` anti-pattern
- `modules/sqon/src/index.ts`: exported `SQON`, `SqonBuilder`, `SqonFieldFilter`, `SqonFieldFilterKey`, `checkMatchingArrays`, `checkMatchingFilter`, `emptySqon`
- `modules/sqon/src/builder/index.test.ts`, `modules/sqon/src/__tests__/schema.test.ts`: new/extended BDD tests (91 + 152 total passing)
- `modules/graphql-router/src/network/utils/sqon.ts`: swapped `@overture-stack/sqon-builder` import for `@overture-stack/sqon`; removed `@ts-expect-error`; `convertToSqon` now returns `Result<SqonNode, ...>` via `SQON.from(filter).toValue()`
- `modules/components/src/DataContext/types.ts`: `SQONType` now aliases `SqonNode | null` (from `@overture-stack/sqon`)
- `modules/components/src/Table/DownloadButton/DownloadButton.tsx`: swapped `SQONBuilder.in(...)` for `SQON.in(...)`
- `modules/graphql-router/package.json`, `modules/components/package.json`: replaced `@overture-stack/sqon-builder` dependency with `@overture-stack/sqon` (local workspace ref)
- `modules/sqon/src/index.ts`: updated exports to use combined value+type re-export syntax
- `modules/sqon/src/builder/index.test.ts`: updated all references to match renamed identifiers
- `modules/graphql-router/src/network/utils/sqon.ts`, `modules/components/src/Table/DownloadButton/DownloadButton.tsx`: updated to `SqonBuilder` (was `SQON`)
- `modules/sqon/README.md`: rewrote to document builder API; added usage section covering the recommended `SqonNode`-at-boundaries pattern, `SqonBuilder.from()` for validation, filter and combination examples, and type reference table
- `modules/sqon/src/__tests__/buildQueryFilter.test.js`, `modules/sqon/src/builder/index.test.ts`, `modules/sqon/src/__tests__/schema.test.ts`, `modules/graphql-router/src/middleware/__tests__/buildQuery/normalizeFilter.test.js`, `modules/components/src/SQONViewer/utils.test.js`: added failing tests specifying the `'filter'` → `'fuzzy'` canonical op rename; all intentionally red pending implementation
- `modules/sqon/src/operators/constants.ts`: `FILTER` entry in `sqonFieldOperatorProperties` renamed to `WILDCARD: 'wildcard'`; `'filter'` and `'fuzzy'` added to `sqonAliasProperties` and `SQON_OP_ALIASES` as backward-compat aliases resolving to `'wildcard'`; `SQON_FIELD_OPS` updated to reference `WILDCARD`
- `modules/sqon/src/operators/index.ts`: `getSqonFieldOperatorDetails` switch case updated from `'filter'` to `'wildcard'`
- `modules/sqon/src/schema/index.ts`: `FuzzyFilterSchema` renamed to `WildcardFilterSchema`; `op` union now accepts `'wildcard'` (canonical), `'filter'`, and `'fuzzy'` (both legacy aliases)
- `modules/sqon/src/schema/types.ts`, `modules/sqon/src/jsonSchema/runtime.ts`, `modules/sqon/src/index.ts`: `FuzzyFilterSchema` → `WildcardFilterSchema` throughout; JSON Schema `$defs.Fuzzy` → `$defs.Wildcard`
- `modules/sqon/src/builder/index.ts`, `modules/sqon/src/builder/utils.ts`: `makeFuzzyLeaf` → `makeWildcardLeaf`; builder emits `op: 'wildcard'`; `SqonBuilderHandle.fuzzy()` / `SqonBuilder.fuzzy()` renamed to `wildcard()`; TSDoc updated
- `modules/sqon/src/builder/index.test.ts`, `modules/sqon/src/__tests__/schema.test.ts`, `modules/sqon/src/__tests__/jsonSchema.test.ts`: tests updated to `'wildcard'`; added backward-compat test for `op: 'fuzzy'`; 94 sqon tests pass
- `modules/graphql-router/src/middleware/constants.js`: `FUZZY_OP` → `WILDCARD_OP = 'wildcard'`; `OP_ALIASES` now maps both `filter` and `fuzzy` to `WILDCARD_OP`
- `modules/graphql-router/src/middleware/buildQuery/index.js`: `getFuzzyFilter` → `getWildcardFilter`; `opSwitch` branches on `WILDCARD_OP`; 130 graphql-router tests pass
- `modules/graphql-router/src/middleware/__tests__/buildQuery/normalizeFilter.test.js`, `buildQueryFilter.test.js`: updated expected canonical op to `'wildcard'`
- `modules/components/src/SQONViewer/utils.js`: `isFuzzyFilter` → `isWildcardFilter`; helper now returns true for `'wildcard'`, `'fuzzy'`, and `'filter'`
- `modules/components/src/SQONViewer/utils.test.js`: test renamed and extended with `'wildcard'` and transitional `'fuzzy'` alias cases
- `modules/components/src/SQONViewer/index.jsx`: import and two call sites updated to `isWildcardFilter`
- `modules/components/src/SQONViewer/types.ts`: `ArrayFieldKeys` now includes `'wildcard'`
- `modules/components/src/TextFilter/TextFilter.jsx`, `modules/components/src/QuickSearch/QuickSearchQuery.js`, `modules/components/stories/SQONViewer.js`: emit `op: 'wildcard'`
- `modules/components/src/TextFilter/__tests__/TextFilter.test.js`: expected output updated to `'wildcard'`; input fixture stays `'filter'` for backward-compat coverage; 28 component tests pass
- `modules/sqon/README.md`: `SqonBuilder.fuzzy()` → `SqonBuilder.wildcard()`; backward-compat note updated
- `docs/usage/03-sqon-in-detail.md`: "Fuzzy operator" section renamed to "Wildcard operator"; description clarified (case-insensitive substring match via ES/OS wildcard query, distinct from edit-distance fuzzy); canonical op in example updated to `"wildcard"`; aliases table extended with `filter` → `wildcard` and `fuzzy` → `wildcard`
- `CHANGELOG.md`: added `### SQON operators` entry explaining the rename and the semantic distinction between wildcard (substring) and fuzzy (edit-distance)
- `.dev/roadmap.md`: added "Fuzzy (edit-distance) SQON operator" feature item with implementation notes and the design question to resolve before building it
- `modules/sqon/package.json`, `modules/sqon/tsup.config.ts` removed in favour of CLI flags, `modules/sqon/src/version/constants.ts`: switched sqon build from `tsc` to `tsup` with dual ESM+CJS output; added conditional `exports` field so CJS consumers can `require()` the package; fixed `import.meta.url` usage to fall back gracefully in CJS context; resolves `integration-tests-import` failure where components' Babel CJS build could not load the ESM-only sqon package
- `integration-tests/import/package.json`, `integration-tests/import/test.ts`: added `@overture-stack/sqon` as a direct dep; added test asserting `SqonBuilder`, `SqonSchema`, and `SQON_SCHEMA_VERSION` are importable from the CJS build; removed sqon from the "pure ESM" exclusion comment (graphql-router remains excluded)
- `package.json`: added `"esbuild": "0.17.19"` to both `overrides` and `devDependencies`; the override alone is insufficient because npm does not apply overrides to peer dep auto-installation - making it an explicit devDep forces the correct version at the root where bundle-require loads it; tsup upgrade to 8.5.1 attempted and reverted (esbuild hoisting conflicts under npm); logged pnpm migration and tsup upgrade as standalone tech-debt

Fact-checked the search engine permissions reference against the authoritative OpenSearch source (`static_action_groups.yml`); corrected two mistakes introduced in the 2026-06-28 session; corrected a further mistake about alias resolution permission level, verified against live cluster behaviour and OpenSearch static plugin config.

- `modules/graphql-router/src/searchClient/index.ts`: fixed wrong permission name in the dual-403 error message: `cluster:monitor/nodes_info` is not a real permission; the correct transport action is `cluster:monitor/nodes/info`
- `docs/setup.md`: (1) corrected the core search section: `read` does not cover `indices:admin/mappings/get` or `indices:admin/aliases/get`; both must be granted explicitly alongside `read`; (2) fixed `cluster:monitor/nodes_info` → `cluster:monitor/nodes/info` in the auto-detection table; (3) updated the summary table data index column to list all three required permissions
- `overture/infra/.dev/docs/opensearch/deployment.md` (cross-repo): fixed `cluster:monitor/nodes_info` → `cluster:monitor/nodes/info` in the Arranger breakdown section (two occurrences); added note that index-level `indices:admin/aliases/get` is redundant (already covered by `cluster_composite_ops_ro` at cluster level via `GET /_cat/aliases`)
- `docs/setup.md`: core search section restructured: alias resolution moved from index-level to cluster-level (Arranger uses `cat.aliases`, a cluster-wide API; `cluster_composite_ops_ro` covers it); Sets recommendation corrected from `create_index` to `manage` (`create_index` does not include `indices:admin/exists`); summary table updated to reflect both corrections
- `.dev/tech-debt.md`: logged `cat.aliases` → `indices.getAlias` refactor as a standalone privilege-minimization item
- `.dev/docs/search-engine-integration.md`: new internal reference document for maintainers covering auto-detection flow, startup sequence, query execution, downloads, Sets operations, and the permission model for each; includes links to OpenSearch and Elasticsearch 7.17 API docs; updated with permission source citations (OS permissions reference and default action groups), inline API links for per-request/downloads/saveSet sections, and a note that ES does not publish a canonical transport action list
- `.dev/tech-debt.md`: logged missing unit tests for `getESAliases`, `getAllData` pagination, and `resolveSetsInSqon` as standalone entries
- `modules/graphql-router/src/graphqlRoutes.ts`: `initializeSets` is now skipped when `DISABLE_SETS` is true; previously the flag was wired through the config system but never checked at the call site
- `modules/types/src/configs/constants.ts`: removed the "not fully implemented yet" TODO comment from `DISABLE_SETS` (the flag now does what it says)
- `modules/graphql-router/src/config/utils/index.ts`: moved `disableSets` guard into `initializeSets` (was in the caller); function accepts `disableSets?: boolean` and early-returns; makes the skip behaviour unit-testable without a real ES client
- `modules/graphql-router/src/config/utils/index.test.ts`: new unit tests for `initializeSets` covering: skip when disabled (explicit false and omitted), creates index on first run, no-ops when index exists, throws on creation failure
- `modules/types/src/configs/constants.ts`, `modules/graphql-router/src/config/utils/index.ts`, `modules/graphql-router/src/graphqlRoutes.ts`, `apps/search-server/src/configs/fromEnv/localEnvs.ts`, `apps/search-server/src/configs/fromEnv/aggregator.ts`, `integration-tests/server/test/index.test.ts`, `integration-tests/mcp-server/test/index.test.ts`, `apps/search-server/.env.schema`, `modules/graphql-router/README.md`, `.dev/roadmap.md`, `.dev/tech-debt.md`: renamed `DISABLE_SETS`/`disableSets` to `ENABLE_SETS`/`enableSets`; Sets now defaults to disabled and requires explicit opt-in
- `modules/graphql-router/src/config/utils/index.ts`, `modules/graphql-router/src/graphqlRoutes.ts`: fixed multicatalog race condition: `resource_already_exists_exception` during `initializeSets` is now treated as success; Sets initialization failure no longer takes down the catalogue's GraphQL endpoint
- `modules/graphql-router/src/config/utils/index.test.ts`: added tests for the race condition path (exception treated as success) and non-race errors (still propagate)
- `scripts/ping-elasticsearch.sh`: when `SEARCH_ENGINE` is not set, the script now detects the engine type after the cluster is ready by probing `GET /` and checking for `"distribution":"opensearch"`; the "Ready" banner and all subsequent output use the correct label; mirrors Arranger's own Stage 1 auto-detection logic
- `.dev/docs/search-engine-integration.md`, `docs/setup.md`: corrected alias resolution permission: `indices:admin/aliases/get` is an index-level permission (not cluster-level); OpenSearch's `manage_aliases` built-in group is `type: "index"` in `static_action_groups.yml`; `GET /_cat/aliases` is evaluated by the index-level privilege evaluator against all indices and requires the permission on `*`; `cluster_composite_ops_ro`'s `indices:admin/aliases/get*` grant does not cover direct alias API calls; removed `cluster_composite_ops_ro` from the summary table cluster column (it was listed there solely as the alias resolution grant, which was incorrect)
- `scripts/ping-elasticsearch.sh`: fixed two bugs: (1) the retry loop used `> /dev/null` so curl exit code 0 was treated as success even on 403, making the "ready" check a pure TCP check with no HTTP validation; now checks for a 2xx response code using `-w '%{http_code}'` piped to grep; (2) the health display silently showed blank fields and ❓ when `/_cluster/health` returned 403, with no indication of why; now shows a clear message with the HTTP code and the permission name to add; also uses `SEARCH_ENGINE` env var for the label so the output says "OpenSearch" instead of "Elasticsearch" when configured accordingly; requires `cluster:monitor/health` on the reader role for the retry to succeed and for full health display
- `.dev/docs/search-engine-integration.md`, `docs/setup.md`: added `cluster:monitor/health` to startup sequence, permission reference table, and user-facing setup guide; clearly marked as startup-script only (not application code); added footnote distinguishing it from application-level permissions
- `.dev/roadmap.md`: added "Decouple startup health check from application credential" to the Deployment section; describes why the current coupling is wrong and what the correct fix is (`GET /` via `cluster:monitor/main` for liveness; remove `cluster:monitor/health` dependency)
- `scripts/ping-elasticsearch.sh`: removed mutational engine-label logic (placeholder assignment in a `case`, conditionally overwritten later based on a string-equality check); engine detection is now a single-assignment `engine_label()` function; `if [ $? -ne 0 ]` replaced with `if ! command; then`
- `.dev/roadmap.md`: rewrote "Decouple startup health check from application credential" with an init-container design: elevated credential (`cluster:monitor/health`) confined to an init container that owns the `wait_for_status=yellow` readiness gate and the cluster-status log output; main container runs with `cluster:monitor/main` only; scope note updated to flag the new Vault role/policy, VSO secret, and Helm `initContainers` work this requires
- `modules/graphql-router/src/middleware/__tests__/buildQuery/buildQueryFilter.test.js`: added a failing test specifying that `op: 'fuzzy'` must produce the same ES output as `op: 'filter'`; this is the behavioral specification for the upcoming canonical-op flip; the test is intentionally red now and will go green when the flip is complete
- `~/.claude/CLAUDE.md`, `agentics/CLAUDE.md`, `agentics/AGENTS.md`, `agentics/template/CLAUDE.md`: added "verify purpose alignment before implementing" to Interaction parameters; added to agentics CHANGELOG.md

---

## 2026-06-29

Malformed SQON filter clauses that previously passed schema validation and then generated invalid or silent Elasticsearch errors now fail at parse time with a schema error.

- `modules/sqon/src/schema/index.ts`: `fieldName` now requires min(1) on all filter types; `BetweenFilterSchema` now requires exactly 2 values (was accepting scalar or >2); `AllFilterSchema` now requires an array value (was accepting scalar); `FuzzyFilterSchema` now requires all entries in `fieldNames` to be non-empty strings
- `modules/sqon/src/__tests__/schema.test.ts`: added tests for the new constraints (`between` scalar/length, `all` scalar, `filter` empty fieldName, empty fieldName across all leaf operators)
- `.dev/roadmap.md`: added MCP surface unification note to the sqon-builder absorption section
- `README.md`, `docs/overview.md`, `docs/setup.md`: documented minimum supported versions (ES 7.0+ licensed, OpenSearch 1.x+) and noted that ES 8.x and ES OSS are not supported; existing ES-only callouts updated to cover both engines

---

## 2026-06-28

Search engine startup errors now tell operators exactly what went wrong and what to do; fixed a silent bug that sent garbled credentials when no auth was configured; detection now works even when the root endpoint is blocked by permissions.

- `modules/graphql-router/src/searchClient/index.ts`: 403 now names the missing `cluster:monitor/main` permission and surfaces `SEARCH_ENGINE` as a bypass; 401 identifies bad credentials; network errors report the target host; fixed: auth header no longer sent when credentials are absent (was encoding "undefined:undefined"); per-status messaging and version detection isolated as named helpers; added two-stage fallback for 4xx: check `X-Elastic-Product` header (ES 7.14+), then probe `/_nodes/_local` for `build_flavor` on 403 (covers ES 7.0-7.13 and OpenSearch without `cluster:monitor/main`)
- `modules/graphql-router/src/searchClient/index.test.ts`: new co-located test file; 21 tests covering all detection paths including header fallback, `_nodes/_local` fallback, 401-does-not-probe, and auth header forwarding
- `modules/graphql-router/src/searchClient/index.ts`: `detectClientTypeFromNodesEndpoint` now returns `'denied'` on 403 (distinct from other failures); when both `GET /` and `_nodes/_local` are blocked, the error message names both missing permissions explicitly rather than repeating the root-endpoint error
- `docs/setup.md`: added search engine permissions reference section covering core search, auto-detection (with SEARCH_ENGINE bypass tip), and Sets; operators can now diagnose 403 startup failures without reading source code
- `DEVELOPMENT.md`: added pointer to the permissions reference for contributors testing against secured clusters
- `apps/search-server/index.ts`: startup failures exit with code 1 reliably; previously depended on Node's unhandled-rejection behaviour, which varies across versions
- `.dev/roadmap.md`: added `build_sqon` MCP tool item to the MCP integration readiness section; updated section intro from three to four items

---

## 2026-06-24

Added `getAllData` to the `graphql-router` utils barrel export (was missing, causing `ERR_PACKAGE_PATH_NOT_EXPORTED` for a downstream consumer); extended the `integration-tests/import` tech-debt entry with two explicit gaps.

- `modules/graphql-router/src/utils/index.ts`: re-exported `getAllData` as a named export; must evaluate whether this is a desirable pattern for future versions
- `.dev/tech-debt.md`: `integration-tests/import` entry extended with two TODOs: verify each `exports` subpath by name (not just the root), and document what each exported method is and what it is for

---

## 2026-06-19

**Done:**

- Removed em-dash and double-dash punctuation from all Arranger `.dev/` documents (roadmap.md, sessions.md, tech-debt.md).
- Updated agentic instructions accordingly, to prevent those being used in the future.

**Decisions:**

- Existence disclosure and admin listing/access separation are Usher-level decisions; documented those in usher/.dev/design/permissions-model.md instead. Arranger roadmap auth section now points there rather than duplicating the decisions.

---

## 2026-06-18

**Done:**

- Added "GA4GH Beacon v2 module" to roadmap.md (low priority, Features section). Scoped as
  `modules/beacon` npm package mounting an optional Express router inside search-server alongside
  graphql-router. Covers rationale for module-not-app approach, filtering term registry as the
  key design problem, entry type: catalogue mapping, three-phase scope (count/boolean first;
  record-level + Usher; full GA4GH Passport), and cross-references to arranger-core extraction,
  Usher, transport layer abstraction, and search-server route organization items.
- Added three tech-debt entries:
    - `hackyTemporaryEsSetResolution.js`: ES 6.2 workaround, condition met since ES 6.3; also reads `fallbackConfigs.sets.index` from global instead of a parameter (convention violation). Under `## graphql-router` in tech-debt.
    - Chart tooltip pluralization: custom CSS label approach blocks pluralize usage; fix is prop-based singular/plural pair. Under `## modules/charts`.
    - `SUPPRESSION_INCREMENT_VALUE` not configurable: hardcoded `0.2` from PR #1074 should be a `BarChartProps` prop. Under `## modules/charts`.
- Created `docs/migration/v3.1.md`: covers only genuine breaking changes (env var renames, Docker image rename, `MAX_RESULTS_WINDOW` now enforced). Config directory section removed (flat layout still works as single-catalogue). Introspection section removed (new feature, not breaking). References Helm chart 0.4.0 and links to CHANGELOG.md.
- Created `CHANGELOG.md` at repo root: high-level 3.1 release narrative covering architecture, server, MCP server, charts, and infrastructure. Distinct from per-package Changesets output (those will appear when Phase 3.1 CI/CD work lands). Breaking changes, new features, and removed/renamed items all covered.
- Rewrote `modules/graphql-router/README.md`: full proper README covering what the module is, quick start, `arrangerRouter` API options table, configuration reference (connection, catalogue identity, feature flags, table, query limits), network search federation (using `feat/charts-with-network-aggregation` branch format with `nodeId`, per-node `requests.headers`, and global `remoteRequests.headers`), server-side filters, and other exports (`buildSearchClient`, `resolveCatalogueFields`, `mergeConfigs`, types, sub-paths).
- Added tech-debt entry for missing `apps/search-server` README (under new `## apps/search-server` section).
- Added "What doesn't change" section to `docs/migration/v3.1.md`: explicitly states one-instance-per-catalogue pattern is unaffected, flat layout still works.
- Added "Consolidating multiple single-catalogue instances" section to `docs/migration/v3.1.md`: covers subdirectory layout, URL path changes (`/graphql` to `/{id}/graphql`), moving `ES_INDEX`/`DOCUMENT_TYPE` env vars into `base.json` as `esIndex`/`documentType`, and the `"index"` vs `"esIndex"` key distinction.
- Expanded `CHANGELOG.md`: added `### Components` section (select all, column width, quoted QuickSearch, TSV download, accessibility, non-SSR fix, Axios security bump) and additional bar chart bullets (sortable by label, tooltip text wrap, Y axis offset, consistent tooltips, handlers prop move).
- Restructured `docs/overview.md` "Next steps" to "Where to go from here": four independent goal-based bullets, non-linear. Added link to multicatalogue consolidation guide.
- Created `docs/usage/04-introspection.md`: standalone introspection API doc covering all three endpoints and the single-catalogue `/introspection/fields` alias. Moved out of `03-sqon-in-detail.md`, which now holds a brief cross-reference. Updated CHANGELOG link accordingly.
- Confirmed overture.bio docs sidebar is autogenerated from the filesystem (symlinker.sh links arranger/docs/ in as a submodule). No manual sidebar entries or `_category_.json` needed.
- Identified `hasValidConfig` as a 2.x pattern, superseded by `GET /introspection` preflight in 3.x. Drafted OHCRN migration code: gateway route forwarding to `/introspection`, frontend `checkArrangerCatalogues` replacing per-catalogue `configQuery` calls.
- Added `## Recommended migrations` section to `docs/migration/v3.1.md`: covers the `hasValidConfig` -> `GET /introspection` switch with gateway and frontend code examples.
- Added `hasValidConfig` deprecation entry to `tech-debt.md` under `## graphql-router`: `@deprecated` directive, links to migration guide, standalone: yes.
- Researched other "still works but should migrate" patterns for 3.1. Found two security hardening items new in 3.1 (not present in 3.0): `ALLOWED_CORS_ORIGINS` (open CORS by default) and `GRAPHQL_MAX_ALIASES`/`GRAPHQL_MAX_DEPTH` (no query complexity limits by default). Both added to `docs/migration/v3.1.md` under `## Recommended migrations`. Remaining candidates checked: `configsSource` deprecation already in Deprecations section; `"index"` vs `"esIndex"` already in consolidation section; `enableAdmin`/`enableLogs` move was RC-to-3.0, out of 3.1 scope.
- Added tech-debt entry: download route body is brittle (double-encoded params, `columns` requires full descriptor objects that should be resolvable from the extended mapping (callers should only need `fieldNames: string[]`), no Zod validation, unquoted Content-Disposition filename, opaque error responses). Standalone: no (requires coordinated caller update).
- Audited MCP server for demo-deployment security risks. Added three tech-debt entries under `## apps/mcp-server`, two marked URGENT: (1) no authentication on the MCP endpoint (any reachable agent can call all tools); (2) no rate limiting (session and tool-call flooding possible); (3) `get-catalogue-fields` does not validate `catalogueId` against `ARRANGER_CATALOGUES` allowlist before forwarding to Arranger.

---

## 2026-06-17

**Done:**

- Implemented `MAX_RESULTS_WINDOW` enforcement end-to-end.
    - Extracted `applyResultsWindow(first, maxResultsWindow)` as a named export from `modules/graphql-router/src/mapping/resolveHits.js`. Caps `first` at `maxResultsWindow ?? 10000` before it is passed as `size` to the ES query.
    - Wired `process.env.MAX_RESULTS_WINDOW` (already in `.env.schema`, previously unused) into `apps/search-server/src/configs/fromEnv/localEnvs.ts` under `catalogs.fromEnv.table.maxResultsWindow` with a hardcoded default of 10000. Uses `tableProperties.MAX_RESULTS_WINDOW` constant and `stringToNumber`.
    - Wrote BDD tests in `modules/graphql-router/src/mapping/resolveHits.test.js` (co-located) covering: within-window passthrough, cap at window, per-catalogue smaller window, undefined fallback to 10000, and zero-first edge case.
- Precedence chain confirmed: per-catalogue JSON `table.maxResultsWindow` wins (lodash merge) > `MAX_RESULTS_WINDOW` env var > hardcoded 10000 fallback in `applyResultsWindow`.
- Consolidated the hardcoded `10000` into `tableDefaults.MAX_RESULTS_WINDOW` in `modules/types/src/configs/constants.ts`. All three consumers (`graphql-router/config/constants.ts`, `resolveHits.js`, `localEnvs.ts`) now reference it. One definition.
- Wired `SEARCH_ENGINE` env var into `localEnvs.ts` as `configOptionalProperties.SEARCH_ENGINE`. Renamed `SEARCH_CLIENT_TYPE` to `SEARCH_ENGINE` in `.env.schema` to match the config property name and integration test convention. When unset, `buildSearchClient` auto-detects from the cluster's version API.
- Wired `ROW_ID_FIELD_NAME` env var into `localEnvs.ts` under `fromEnv.TABLE` alongside `MAX_RESULTS_WINDOW`. Added `tableDefaults.ROW_ID_FIELD_NAME = 'id'` to `modules/types`. Removed local `const ROW_ID_FIELD_NAME = 'id'` from `graphql-router/config/constants.ts`. Default required in `fromEnv` because the shallow spread in `router.ts` means `customConfigs.table` (now always present) shadows `fallbackCatalogConfigs.table` entirely.
- Fixed the shallow spread: extracted `mergeConfigs(fallback, custom)` using `lodash-es merge` in `router.ts`. Replaced two-line spread. BDD tests in `router.test.ts` (co-located) cover empty-custom passthrough, partial sub-object merge, override precedence, and no-mutation of either input. Tech-debt entry marked done.
- Wired `DOCUMENT_TYPE` env var into `localEnvs.ts` under `fromEnv` alongside `esHost`/`esIndex`. Empty-string default is correct: validation rejects missing `documentType`; per-catalogue `base.json` always provides the real value in production.
- Rewrote `.env.schema` with section headers explaining server-level vs catalogue-level vars and the trickle-down/override concept. Added three missing vars: `ALLOWED_CORS_ORIGINS`, `GRAPHQL_MAX_ALIASES`, `GRAPHQL_MAX_DEPTH`. Renamed `PORT` to `SERVER_PORT`.
- Fixed stale `PORT=<...>` example in `modules/graphql-router/README.md` line 8; now `SERVER_PORT=<...>`.
- Fixed `DOWNLOAD_STREAM_BUFFER_SIZE` default in `localEnvs.ts`: was `100` (copy-paste error from `DOWNLOAD_MAX_ROWS`), corrected to `2000` to match `fallbackCatalogConfigs` and `.env.schema`.

**Open threads:**

- Confirm OpenSearch exception name for `resource_already_exists_exception` before implementing the `initializeSets` guard.
- Fixed `file:` sibling dep breakage for external npm consumers. Root cause: `npm publish` encodes `file:` paths verbatim in the tarball's `package.json`; those paths don't exist on consumer machines. Affected packages: `modules/types` (`@overture-stack/sqon: file:../sqon`), `modules/graphql-router` and `modules/components` (both `@overture-stack/arranger-types: file:../types`).
- Implemented interim fix: `scripts/fix-workspace-deps.mjs` rewrites `file:` deps to `^<sibling-version>` ranges immediately before each `npm publish` call; `git checkout <pkg>/package.json` restores the original immediately after. Local dev is unchanged.
- Wired the script into the Jenkins publish loop in `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`.
- Documented full decision trail in tech-debt entry (release/publishing section): interim script, what Changesets adds (version management + dependency-ordered publish), what pnpm adds on top (automatic `workspace:` rewriting, making the script unnecessary). Both are needed for the complete long-term fix; neither alone closes the gap.
- Alphabetical publish order (`components`, `graphql-router` before `types`) leaves a short window where published packages reference a `types` version not yet on npm. Acceptable for coordinated release runs; Changesets eliminates it by publishing in dependency order.
- Extended `integration-tests/import` to also cover `@overture-stack/arranger-types` (added as a `file:` dep; checks `configs.configRequiredProperties`, `configs.configOptionalProperties`, and `elastic.esToAggTypesMap` are defined). Comment in test explains the two limitations: (1) `file:` deps mean this catches build regressions, not publishing regressions; (2) graphql-router and sqon are pure ESM and cannot be imported in the current Jest setup.
- Added `scripts/verify-pack.mjs`: loops over `modules/*`, skips `private: true`, reports any `file:` refs in dependencies/devDependencies/peerDependencies. Exits non-zero so it works as a CI gate. Available as `npm run release:check`.
- Logged tech-debt: `integration-tests/import` does not cover graphql-router or sqon (pure ESM; Jest config cannot handle them without further work). Fix options: update Jest transform config, or add a separate `tsx`/`node --input-type=module` smoke test.
- Clarified (and documented in tech-debt) that `apps/*` are not affected by the `file:` publishing bug; they ship as Docker images, not npm packages, so the full monorepo workspace is always present during build.
- Fixed git tag stage blocking error for partial rc releases. `gitPushTags_monorepo` in `jenkins-pipeline-library/vars/stepGitOperations.groovy` was throwing `IllegalStateException` whenever any tag in `versionsMap` already existed on origin, preventing rc.2 releases where only a subset of packages were bumped (components, graphql-router, types) while others remained at rc.1. Fix: parse `git ls-remote` output to identify already-existing tags, skip them with a log message, and only attempt to create and push tags for genuinely new versions. Gracefully exits when all tags already exist rather than throwing.

---

## 2026-06-16

**Done:**

- Added `initializeSets` startup race fix to roadmap as the first Architecture item (high priority): a confirmed multicatalog bug that nondeterministically kills catalogue routers on a fresh cluster.
- Fixed `"field"` / `"fieldName"` in `docs/concepts.md` SQON examples (lines 44, 56, 57). The `00-query-processing.md` instance was correct ES syntax and left unchanged.
- Added three tech-debt entries for missing tests introduced by PR #1076: `filterNodesByNodeId` (pure function, trivial cases), `resolveAggregation` cardinality accumulation, and `generateChartsQuery` network path branching.

**Open threads:**

- Confirm OpenSearch exception name for `resource_already_exists_exception` before implementing the `initializeSets` guard.

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
- Em dashes and double-dashes excluded from all persisted file content (docs, code, comments, config); use colons, semicolons, commas, or parentheses instead.

---

## 2026-06-05

**Done:**

- Updated tech-debt entry "Introspection types should be Zod-first" to cover the broader cross-package source import problem introduced in PR #1065: `apps/mcp-server/src/arranger/types.ts` imports directly from `../../../search-server/src/introspection/types.js`, bypassing the package boundary. Fix path: move types to `modules/types`, define as Zod schemas, both apps import from `@overture-stack/arranger-types`.
- Added tech-debt entry for Express 4 vs 5 / Zod 3 vs 4 version skew between `mcp-server` and `@modelcontextprotocol/sdk`'s internal dependencies. Fix requires a coordinated monorepo-wide upgrade, not isolated per-package.

---

## 2026-05-29

**Done:**

- Added `description` field to `configTemplates/configs.json.schema`: missed when PR #1070 ("add catalogue descriptions") shipped; the annotated schema is the primary human-readable reference for config operators.
- Fixed four factual errors in `/docs`: two stale GitHub links (`modules/server/configTemplates/` to `apps/search-server/configTemplates/`) in `02-arranger-components.md`; wrong key name `"index"` to `"esIndex"` in the base.json example; wrong key name `"active"` to `"isActive"` in the facets.json example.
- Updated repository structure tree in `docs/overview.md`: removed non-existent `modules/server/`, added `apps/` directory with `mcp-server` and `search-server`, expanded `modules/` to show all current packages, added `integration-tests/`, updated descriptions throughout.
- Added tech-debt entry for `setup.md` referencing `.env.arrangerDev` which no longer exists; left unfixed as the correct replacement process is unclear.
- Added three tech-debt entries under `## apps/mcp-server` in `tech-debt.md`: `InMemoryEventStore` not suitable for production (persistent store needed before production deployment); MCP session map does not evict abandoned transports (timestamp-based sweep approach noted); introspection types should be Zod-first so MCP output schemas can import directly from `search-server` rather than duplicating locally
- Updated `sessions.md` protocol in `~/.claude/CLAUDE.md`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and memory: `sessions.md` records only changes to code or working documents, not conversational activity
- Incorporated PR #1065 (MCP server scaffold) as merged into Dockerfile changes: added `apps/mcp-server` workspace to `Dockerfile.jenkins` scaffolding stage; added `mcp-server` Docker stage to both `Dockerfile.jenkins` and `Dockerfile.local`
- Renamed Docker stage `server` to `search-server` in both Dockerfiles: removes ambiguity now that two server images exist
- Rewrote `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy` (Phase 2 CI/CD work):
    - `turboBase` computed once from `GIT_PREVIOUS_COMMIT` (the commit Jenkins last built on this branch) with `HEAD^1` fallback for first builds; correctly covers multi-commit pushes to any branch, including direct pushes to main, without needing branch-specific logic; used for all change detection throughout the pipeline
    - Turbo build with `--filter=[turboBase]` replaces `npm run modules:build`; only affected packages and their dependents build
    - Turbo test with `--filter=[turboBase]` replaces five individual `npm run test -w` calls; `integration-tests/server` and `integration-tests/mcp-server` excluded from Turbo and handled separately
    - `integration-tests/server` runs conditionally: only when files in `sqon`, `types`, `graphql-router`, `apps/search-server`, or `integration-tests/server` changed since `turboBase`
    - Docker builds conditional per image: `search-server` image rebuilds when its server chain or Dockerfile changes; `mcp-server` image rebuilds when `apps/mcp-server`, shared modules, or Dockerfile changes; `POST_BUILD: Publish` parameter overrides and builds both
    - App versions (`searchServerVersion`, `mcpServerVersion`) read directly from `apps/*/package.json` in the Build stage: fixes pre-existing null bug where `versionsMap['server']` was used but `versionsMap` only covered `modules/*`
    - `TURBO_TELEMETRY_DISABLED=1` added to environment block
    - TEMP `release-charts` stage removed; `modules/charts` now covered by the standard release publish loop
    - Dead commented-out Slack notification code removed

**Decisions:**

- `fieldShape` outputSchema without `.parse()` is correct MCP usage: `outputSchema` is declarative for MCP clients, not runtime-enforced by the SDK
- Session eviction approach for `apps/mcp-server/src/http/app.ts`: track `lastSeenAt` per transport entry, sweep via `setInterval`, close and evict sessions idle beyond a configurable TTL (e.g. 30 min)
- `integration-tests/mcp-server` excluded from CI pipeline for now: needs full stack (ES + Arranger server + MCP server); design deferred
- `Deploy to overture-dev` stage left unchanged: infrastructure config for `arranger-iobio` must be updated separately to use the renamed `arranger-search-server` image

**Open threads:**

- `integration-tests/mcp-server` pipeline design: CI setup needs full stack; how to start and wait for Arranger + MCP server alongside ES
- Infrastructure deploy config: `arranger-iobio` deployment references the old `arranger-server` image name; needs updating in the infra repo

---

## 2026-05-28

**Done:**

- Removed `docker/**` and `docker-compose.yml` from `turbo.json` globalDependencies: those files don't affect TypeScript source so they were causing unnecessary cache busting; `tsconfig.eslint.json` remains
- Added `@overture-stack/arranger-types` as an explicit dependency in `modules/components/package.json` (`file:../types`): without this, Turbo's graph treated `components` as independent of `types`, meaning a breaking change to `types` could pass CI without `components` being rebuilt or tested
- Corrected `modules/graphql-router/package.json` to use the shallower `file:../types` (was `file:../../modules/types`, unnecessarily traversing up to root and back down); `modules/types` already used the shallower `../sqon` convention; `apps/` and `integration-tests/` paths are already as shallow as their locations allow
- Completed items removed from roadmap (now in sessions only); roadmap stays forward-looking

**Decisions:**

- Charts CI goal: build and publish integration only; no test script needed; Turbo silently skips packages with no matching script, which is fine here
- lint/typecheck scripts across modules: deferred; not needed until Phase 4 CI gate work
- `next` Docker/NPM tagging: deferred to a later pass after core Turbo pipeline is working
- Charts to fold into the standard `release` publish loop; `TEMP. Publish Charts to NPM` stage to be removed
- Workflow: completed roadmap items are removed (not marked done); sessions.md is the historical record; sessions entries should be self-contained descriptions, not references to numbered roadmap items

---

## 2026-05-27

**Done:**

- Fixed `/introspection/fields` correctness bug: each `arrangerRouter` instance now fetches the ES mapping once at startup, resolves live fields via `resolveCatalogueFields` (pure transform), and serves them from a local `GET /introspection` endpoint; `search-server` dispatches `/introspection/:catalogId` via URL rewriting; `catalogDetails.ts` deleted; logic lives in `graphql-router/src/introspection/buildCatalogueIntrospection.ts`
- Moved `fetchMapping`, `getESAliases`, `checkESAlias`, and `getIndexMapping` from `mapping/utils/` and `graphqlRoutes.ts` into `searchClient/fetchMapping.ts`; all ES I/O now in one layer
- Added `description` as an optional catalogue config property (`configOptionalProperties.DESCRIPTION` in `modules/types`): surfaces in both the root `/introspection` response and the per-catalogue `/introspection/:catalogId` response via conditional spread (key absent when not configured, not `undefined`)
- Restructured `CatalogIntrospectionResponse`: removed `validOperators` from individual fields; added top-level `operators: Record<string, string[]>` keyed by field type; `buildFieldOperators()` in `buildCatalogueIntrospection.ts`
- Updated unit tests to match new shape; added coverage for `description` present/absent and `operators` deduplication
- Added `mcp-server` Docker target to both `docker/Dockerfile.local` and `docker/Dockerfile.jenkins`, mirroring the existing `server` target structure
    - Both targets `COPY --from=scaffolding` the shared `node_modules` and `apps/mcp-server` source; no internal modules are copied because the MCP server is standalone (talks to Arranger over HTTP, not ES directly)
    - CMD runs `node_modules/.bin/tsx ./apps/mcp-server/src/index.ts` (no shell-level pre-check; `validateArrangerConnection` runs in-app at startup)
    - EXPOSE 3100 matches the `MCP_PORT` default
- Updated `docker/Dockerfile.jenkins` scaffolding stage to include `--workspace apps/mcp-server` in the `npm ci --omit=dev` install, so the jenkins production image installs the MCP server's runtime deps
- Moved `tsx` from `devDependencies` to `dependencies` in `apps/mcp-server/package.json` (load-bearing for the jenkins build, which runs `npm ci --omit=dev`; mirrors what `apps/search-server` already does)
- Updated both `.dockerignore` files (`Dockerfile.local.dockerignore`, `Dockerfile.jenkins.dockerignore`) to add `!apps/mcp-server`, allowing the folder through the build context

**Decisions:**

- `operators` (not `typeOperators`): cleaner, consistent with existing "operators" vocabulary in SQON introspection
- `buildFieldOperators` (not `buildTypeOperators`): "field operators" is the established naming family in `modules/sqon` (`SqonFieldOp`, `SqonFieldOperatorDetail`, `getSqonFieldOperatorDetails`)
- `description` on per-catalogue response too (not just root listing): complete data at the endpoint; LLM context optimization is the MCP layer's responsibility
- `getValidOperators` to `modules/sqon` consolidation is out of scope: requires redesigning `applicableTo` data in `getSqonFieldOperatorDetails` (range types incorrectly include `filter`, `some-not-in`, `all` at present); separate roadmap item
- MCP server target does NOT use a shell wrapper or pre-flight script. The app's own `validateArrangerConnection` handles the Arranger readiness check at startup; duplicating that at the shell level would be redundant.
- Kept tsx-from-source at runtime (not a tsc pre-build) to match `apps/search-server`'s pattern. Revisiting that for both apps together is a future concern.
- Did not modify `docker-compose.yml`; that's a separate "is the MCP server part of the dev stack?" decision.

**Open threads:**

- `getValidFieldOperators` to `modules/sqon` consolidation: follow-up when sqon consolidation roadmap item is picked up
- `package-lock.json` will need an `npm install` to reflect tsx moving sections in `apps/mcp-server/package.json`.
- `docker-compose.yml` does not include the MCP server. If the local Compose dev stack should boot MCP alongside server/ES/UI, that needs a follow-up (port 3100, depends_on server, ARRANGER_BASE_URL pointed at the `server` service).

---

## 2026-05-26

**Done:**

- Reviewed LLM model evaluation document (text-to-SQON benchmarking framework) as Arranger maintainers; provided technical commentary on fixtures, harness, scoring metrics, and model candidate list
- Identified that SQON fixture-001 uses `"value": [true]` which fails `SqonSchema.safeParse()`: `SqonScalarValueSchema` is `string | number` with no boolean; `"value": ["true"]` is the correct form
- Added two tech-debt entries: boolean values not accepted in SQON schema; `getValidOperators` and `getSqonFieldOperatorDetails` are divergent implementations of the same rules
- Added roadmap item: consolidate field-type-to-operator rules into `modules/sqon`
- Fleshed out `sqon-builder` absorption into `modules/sqon` as a detailed roadmap item: what to keep (builder API, `reduceSQON`, filter manipulation, `from()`), what to fix (operator coverage gap, only `in`/`gt`/`lt` today), what to leave behind (the `& SQON` anti-pattern), and migration path
- Added anchor links to all cross-references between `tech-debt.md` and `roadmap.md`
- Added `integration-tests/mcp-server` workspace with end-to-end tests for `apps/mcp-server`
    - Spins up Arranger search-server in-process (multicatalog mode) with two test catalogs, then starts the MCP server pointed at it, then drives it over Streamable HTTP via the official MCP SDK Client
    - Connection assertion is implicit: `validateArrangerConnection` runs before `app.listen`, so the suite reaching the test phase proves the MCP-to-Arranger contract works
    - Test coverage: spinup/active (ping, capabilities, resource/tool listings), MCP resources (`arranger://introspection/server`, `arranger://introspection/sqon`, `arranger://introspection/catalog/{id}` via template), MCP tools (`list-catalogs`, `get-sqon-schema`, `get-catalog-fields` happy + 404 paths)
    - 13 tests in 4 suites; runs against the same local ES used by `integration-tests/server`
- Added `integration-tests/mcp-server` to the root `package.json` workspaces list

**Decisions:**

- `sqon-builder` is absorbed into `modules/sqon`, not the other way around: `modules/sqon` is the host; it grows to subsume `sqon-builder`'s builder API
- The `& SQON` type pattern in `sqon-builder` is a design mistake: explicitly named and documented as such; the correct design is a clean wrapper with explicit `toValue(): SqonNode` extraction
- Boolean values should be supported in SQON (not just string `"true"`); fix is additive; add `zod.boolean()` to `SqonScalarValueSchema`; confirmed this is an oversight, not deliberate
- The `/introspection/fields` endpoint is the canonical LLM context source; the evaluation document should reference it specifically rather than "GraphQL introspection"
- JSDoc/TSDoc should be added to functions and types as code is written or touched; not deferred to a documentation pass; inline docs are the safety net when `/docs` lags
- Backend: spin up search-server in-process (mirrors `integration-tests/server`), not external nor mocked; keeps the harness self-contained while exercising the real Arranger contract.
- Coverage: multicatalog only; exercises the catalog resource template and `list-catalogs` with >1 catalog. Single-catalog is a subset and not worth doubling runtime for.
- Catalog field introspection (`/introspection/{catalogId}`) reads from `catalogConfigs.extended`, which is empty in the existing `integration-tests/server` multiconfigs. New fixtures under `integration-tests/mcp-server/multiconfigs/` include populated `extended` arrays so the tests can assert real field metadata.
- Test files live under `test/` and the entry point is `test/index.test.ts`. Node 24's test runner auto-discovers `.ts` files in `test/`; node 20 does not, so this suite requires node 24+ (consistent with the project's `engines.node >= 20` but practically aligned with the dev shell setup).
- Lazy MCP client access via `getClient: () => Client`: `node:test` suite factories run at registration time, before `before()` hooks have populated state. Each test resolves the client when it actually runs.

**Open threads:**

- Boolean support in SQON schema: fix is clear but not yet implemented (two schema files, one in `sqon-builder`, one in `modules/sqon`)
- `reduceSQON` extension for full operator set needs deliberate design (e.g. what does reducing two `between` ranges under `and` mean?)
- Single-catalog coverage is not exercised; can be added if MCP server adds single-catalog-specific behavior (currently it doesn't differentiate).
- Negative test for `validateArrangerConnection` failure on startup is covered by unit tests (`apps/mcp-server/src/arranger/validation.test.ts`); not duplicated as an integration test because the production startup path calls `process.exit(1)`, which is awkward to exercise in-process.

---

## 2026-05-21

**Done:**

- Added PR #1066 review feedback: type rename regression (`SupportedSearchClients` to `SupportedClientTypes` buried in wrong PR), dead validation code in `getNetworkPassthroughHeaders`, mutation-based normalize design, missing tests, `network.json` template bug (`[""]` vs `[]`), security note on all-or-nothing header passthrough, unrelated `integration-tests/import` change
- Added tech-debt: `SupportedSearchClients` rename regression risk (PR #1066), `esToAggTypeMap` duplication (once release-charts merges)
- Added tech-debt: inconsistent unit test file placement (`__tests__/` vs co-located): global preference saved to memory and `~/.claude/CLAUDE.md`
- Added tech-debt: `/docs` out of date: marked urgent, reminder added to session start and end in both agent files
- Updated AGENTS.md and copilot-instructions.md: replaced OWASP category labels with 10 concrete code-level security triggers; removed external URL from agent files
- Updated DEVELOPMENT.md (user edit: admin-ui and integration-tests/admin removed from structure listing)
- Fixed sessions.md gap (root cause: reactive end-of-session trigger); backfilled missing entries for 2026-05-19 and 2026-05-20
- Updated session-end instruction in CLAUDE.md and AGENTS.md and copilot-instructions.md: changed from reactive ("at end of session") to proactive ("after any meaningful unit of work concludes")
- Added BDD migration guidance to all instruction files (`~/.claude/CLAUDE.md`, project `CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`) and memory: `suite()`/`test()` from `node:test`, `assert` from `node:assert/strict`, no additional libraries; migration is gradual; new tests BDD from start, existing tests nudged in scope

**Decisions:**

- Agent instruction files should use actionable inline triggers, not links to external docs; links incur unnecessary fetch cost for agents
- Test files must be co-located with source (`validation.test.ts` next to `validation.ts`), not in `__tests__/` folders; applies globally across all projects
- `/docs` updates are part of the definition of done for every feature; not a separate follow-up
- BDD pattern adopted using `node:test` primitives only (`suite`, `test`, `assert`); no test library additions; `suite()` for grouping, `test()` for behaviour cases, matching the pattern already in use in `integration-tests/server/`

**Open threads:**

- Release gate script names (`release:test:packages` etc.): proposed but not yet confirmed; roadmap items not yet added

---

## 2026-05-20

**Done:**

- Fixed duplicate `## search-server / graphql-router boundary` header in tech-debt.md
- Added roadmap item: config validation with structured errors and tests (Zod, standalone, not blocked on config separation)
- Added roadmap item: Admin UI replacement (low priority, coordinate with config separation)
- Added roadmap item: multicatalog catalog lifecycle and metadata (from `MULTICATALOG_ROADMAP.md` in search-server)
- Added multi-catalog filter composition bullet to Auth section in roadmap
- Created `DEVELOPMENT.md` at repo root: internal developer guide covering setup, repo structure, tests, `.dev/` working documents, and AI tooling

**Decisions:**

- `DEVELOPMENT.md` is the human-facing internal dev doc; `CONTRIBUTING.md` stays as the external/community-contributor doc
- Release gate script names should be declarative (describing scope, not speed): `release:test:packages`, `release:test:server`, `release:artifacts:verify`; pending confirmation before adding to roadmap

**Open threads:**

- Release gate script names (`release:test:packages` etc.): proposed but not yet confirmed by Andy; roadmap items not yet added

---

## 2026-05-19

**Done:**

- Added 5 roadmap items: pin `turbo` as root devDependency, standardize publishable package contents (`files` allowlists), release gate scripts, multicatalog catalog lifecycle (later moved to 2026-05-20 session)
- Added docs reminder to tech-debt and session checklists (later formalized on 2026-05-21)
- Identified `aggsType` gap in charts pipeline: `ExtendedMappingInterface` lacks `aggsType`; `extendCharts.ts` is a stub; proposed 3-file fix (later found resolved in release-charts)

**Decisions:**

- `aggsType` should be computed server-side in `extendFields` (not client-side): later superseded by release-charts fix

**Open threads:** `aggsType` gap analysis superseded; see 2026-05-20

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

- Emoji should be adornment only; no semantic meaning in docs or markers
- "Current focus" in roadmap is the developer's responsibility at session start
- `0.0.0-dev` in main is intentional; versioning is a release-branch concern, not a dev concern
- "edge" to "next" is a Docker image tag change; NPM `next` from main is a separate decision
- Emotion replacement gates theming engine extension; decide Radix/ShadCN first
- Config separation blocked on core extraction; Zod validation follows from that
- hits/edges/nodes redesign should be designed alongside core extraction
- Schema versioning strategy must be decided before redesign work starts
- Facet sort order persistence deferred until Admin/auth model is defined
- nx is a Turbo alternative, not a complement; Turbo + pnpm remains the plan
- Bugs go to tech-debt, not roadmap

**Open threads:** none; NPM `next` from main confirmed as desired; captured in Phase 2.4

---

## 2026-05-16

**Done:**

- Implemented GraphQL alias/depth DoS protection: `maxAliasesRule` and `maxDepthRule` in `modules/graphql-router/src/utils/queryValidation.ts`
- Wired limits as per-catalog config via `configOptionalProperties` (`GRAPHQL_MAX_ALIASES`, `GRAPHQL_MAX_DEPTH`) and `ConfigsObject` in `modules/types`
- Env var reading added to `apps/search-server/src/configs/fromEnv/localEnvs.ts`
- 10 unit tests added in `modules/graphql-router/src/utils/__tests__/queryValidation.test.ts`
- Built out `.dev/roadmap.md` and `.dev/tech-debt.md` from scratch

**Decisions:**

- GraphQL query limits are per-catalog config, not server-level; they tune per-index behaviour
- graphql-yoga is the research-confirmed candidate to replace Apollo Server (not a final decision)
- sqon-builder should be integrated into this monorepo; roadmap item added

**Open threads:** none
