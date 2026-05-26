# Arranger — Technical Debt

Issues logged here when found scope-adjacent to other work. Not a priority backlog — no obligation to fix in order.
`standalone: yes` entries can be picked up freely without broader context.

---

## monorepo — cross-cutting

### Inconsistent unit test file placement
**File:** throughout the monorepo
**Severity:** low (consistency / maintainability)
**Kind:** convention drift
**Issue:** Unit test files follow two competing patterns across the monorepo:
- **(A)** `__tests__/validation.test.ts` in a sibling `__tests__` folder — risks accidentally centralising all tests for a module at a parent or root level as the codebase grows
- **(B)** `validation.test.ts` co-located in the same folder as the file under test — tighter, follows a barrel/module pattern where each unit's test travels with it

The preferred pattern is **(B)**. Mixing the two makes it harder to find tests, harder to enforce coverage, and easier for tests to drift away from the code they cover.
**Fix:** Audit the monorepo and move all `__tests__/` test files to be co-located with their source file, following pattern (B). Update any Jest/node:test config glob patterns that rely on `__tests__/` directory discovery.
**Standalone:** yes — mechanical file moves plus config glob updates, no logic changes

---

## docs [URGENT — reminder every session]

### `/docs` out of date with recent functionality changes
**File:** `/docs` directory
**Severity:** high (ongoing — accumulates with every feature added)
**Kind:** documentation debt
**Issue:** The `/docs` directory has not been kept up to date with recent functionality changes and additions (multicatalog, network search, MCP server, config schema additions, query validation limits, etc.). This is urgent because documentation is a public-facing surface — Arranger integrators rely on it, and stale docs cause support burden and missed adoption.
**Fix:** Audit `/docs` against the current codebase and recent git history. Update each affected page. Treat documentation updates as part of the definition of done for every feature going forward — not a separate follow-up task.
**Standalone:** yes — can be worked on at any time, incrementally, without blocking other work

---

## modules/sqon

### No combined field-type-to-operator-validity endpoint
**File:** `modules/sqon/src/operators/index.ts` — `getSqonFieldOperatorDetails()`; `modules/graphql-router` — `extended` config query
**Severity:** medium (blocks clean validation in MCP / evaluation harness)
**Kind:** missing feature / integration gap
**Issue:** The operator applicability rules exist (`getSqonFieldOperatorDetails()` in `modules/sqon`) and the field type information is available (via the `extended` GraphQL query, which returns ES types from `flattenMappingToFields()`). But these two sources are not connected in any Arranger-native API. A caller who wants to validate whether a given operator is legal for a given field must join both sources themselves. This is a gap surfaced by the LLM evaluation harness (Field & Operator Validity metric) and equally relevant to the MCP server, which should reject invalid operator/field-type combinations before forwarding to Elasticsearch.
**Fix:** Add a query or utility — either a new GraphQL field on the config endpoint or a standalone function in `modules/sqon` — that, given an Arranger index, returns each field name with its ES type and the set of valid SQON operators for that type. `getSqonFieldOperatorDetails()` already encodes the rules; it just needs to be composed with the field list.
**Standalone:** yes — additive, no changes to existing query behaviour

### `getValidOperators` in catalogDetails.ts and `getSqonFieldOperatorDetails` in modules/sqon are divergent implementations of the same rules
**File:** `apps/search-server/src/introspection/catalogDetails.ts` — `getValidOperators()`; `modules/sqon/src/operators/index.ts` — `getSqonFieldOperatorDetails()`
**Severity:** low (currently consistent in practice, but will drift)
**Kind:** duplication / maintenance risk
**Issue:** Two separate implementations encode which SQON operators are valid for which field types. `catalogDetails.ts` has a more nuanced classification (ENUM_LIKE_TYPES, RANGE_TYPES, fallback) while `modules/sqon` returns a flat list with `applicableTo: 'all'` for non-range operators. They're consistent today but maintained independently — any future operator addition requires updating both.
**Fix:** Consolidate into `modules/sqon` as the single source of truth. Extend `getSqonFieldOperatorDetails()` to carry the same field-type classification detail that `catalogDetails.ts` currently encodes locally. `catalogDetails.ts` then becomes a thin projection over the module's data. See [roadmap: consolidate field-type-to-operator rules](roadmap.md#consolidate-field-type-to-operator-rules-into-modulessqon).
**Standalone:** yes — internal refactor, no change to API output

### SQON value schema does not accept boolean values
**File:** `modules/sqon/src/schema/constants.ts` — `SqonScalarValueSchema`
**Severity:** low-medium
**Kind:** schema gap
**Issue:** `SqonScalarValueSchema` is `string | number`, so `SqonScalarOrArrayValueSchema` (used by `InLikeFilterSchema` and others) rejects boolean values. Any Elasticsearch index with a `boolean` field can only be queried via SQON by passing `"true"`/`"false"` as strings — the schema will reject `true`/`false` literals. This is non-obvious and will trip up LLMs generating SQON for boolean fields (and human callers). Surfaced when reviewing the LLM evaluation fixture set.
**Fix:** Add `zod.boolean()` to `SqonScalarValueSchema`. Verify that Arranger's ES query builder handles boolean values in a `terms` clause correctly (Elasticsearch accepts native booleans in `terms`). Update SQON documentation to clarify accepted value types.
**Standalone:** yes — schema-only change; runtime behaviour in ES is already permissive for booleans in `terms` queries

---

## graphql-router

### `GraphQLEndpointOptions` escape hatch
**File:** `modules/graphql-router/src/types.ts` — `GraphQLEndpointOptions`
**Severity:** low
**Kind:** type-weakness
**Issue:** `& Record<string, unknown>` allows callers to pass arbitrary keys without type errors. Exists to accommodate undeclared options but defeats the purpose of the explicit type.
**Fix:** Enumerate all legitimate extra options explicitly, then remove `& Record<string, unknown>`.
**Standalone:** yes — purely additive type change, no runtime impact

### Apollo Server 3 is EOL — replace, don't upgrade
**File:** `modules/graphql-router/src/graphqlRoutes.ts` — `createEndpoint`
**Severity:** medium
**Kind:** design-smell
**Issue:** Apollo Server 3 is end-of-life. Several type errors in this file trace back to AS3 type definitions: `con` not on `ExpressContext` (line ~259), `IRouter` vs `Application` mismatch in `applyMiddleware` calls (lines ~269, ~289), and the `context` API shape. The file itself has a TODO at line 1 noting the upgrade is pending.
**Fix:** The direction is to replace Apollo entirely, not upgrade to v4 — see [GraphQL server migration](roadmap.md#graphql-server-migration-away-from-apollo) in the roadmap. graphql-yoga is the leading candidate. Upgrading to AS4 would be investing in a library the project intends to leave.
**Standalone:** no — part of the broader GraphQL server migration in the roadmap

### Duplicated server instantiation (main + mock)
**File:** `modules/graphql-router/src/graphqlRoutes.ts` — `createEndpoint`
**Severity:** low
**Kind:** design-smell
**Issue:** Main and mock server instances are created with near-identical code blocks. A `// TODO: D.R.Y this thing!` comment acknowledges it.
**Fix:** Will be a natural cleanup opportunity during the Apollo → graphql-yoga migration, when `createEndpoint` gets rewritten anyway. Not worth fixing in isolation against code that's slated for replacement.
**Standalone:** no — better addressed as part of the GraphQL server migration

### `buildContext` connection parameter is vestigial
**File:** `modules/graphql-router/src/graphqlRoutes.ts` — `createEndpoint` > `buildContext`
**Severity:** low
**Kind:** design-smell
**Issue:** The context builder receives a `connection` argument (`{ req, res, connection }`) whose type and origin are explicitly noted as unclear in a TODO comment. This is an Apollo Server artifact — `connection` exists in Apollo's context API for WebSocket subscriptions. Arranger doesn't use subscriptions, so the parameter is vestigial and the type is unresolvable against Apollo 3's definitions.
**Fix:** This will resolve naturally when Apollo is replaced (see [roadmap](roadmap.md#graphql-server-migration-away-from-apollo)). No need to fix in isolation.
**Standalone:** no — tied to the Apollo migration in the roadmap

### Error responses surfacing stack traces
**File:** `modules/graphql-router/src/graphqlRoutes.ts` (error handling / Apollo error formatter)
**Severity:** high (OWASP A09: Security Logging and Alerting Failures, A02: Security Misconfiguration)
**Kind:** security bug
**Issue:** Server error responses are including stack traces visible to API clients. Stack traces leak internal file paths, library versions, and implementation details that assist attackers. They should only appear in server logs, never in API responses.
**Fix:** Strip stack traces from client-facing error responses in the GraphQL error formatter. Optionally surface them when `enableDebug` is true (server-side only) or when `enableAdmin` is active — but that dependency on the Admin model is TBD. Safe default: never send stacks to clients.
**Standalone:** mostly yes — the stack stripping is a one-file fix. The question of whether debug mode re-enables stack visibility is the only part that touches the Admin design.

### GraphQL introspection and field suggestions in production
**File:** `modules/graphql-router/src/graphqlRoutes.ts` — Apollo Server config
**Severity:** medium (OWASP A02: Security Misconfiguration)
**Kind:** security bug
**Issue:** Arranger exposes field name suggestions in error messages and may allow full introspection queries in production. Both leak schema structure to clients. Introspection should be disabled in production (it is already gated by `disablePlayground`, but the introspection query and field suggestion behaviour may be independent of that flag). Possibly a side-effect of using outdated Apollo Server 3 without explicit introspection controls.
**Fix:** Explicitly disable introspection and field suggestions in production. Apollo Server 3 supports `introspection: false` and `stopSuggestions` via the `graphql` validation layer. Verify these are configured correctly and not accidentally left open. This may partially resolve itself when Apollo is replaced — but the config intent should be documented regardless.
**Standalone:** mostly yes for the immediate fix; deeper fix is part of the Apollo migration

---

## modules/types

### Config constants need reorganisation — blocked on architecture work
**File:** `modules/types/src/configs/constants.ts`
**Severity:** medium (grows over time as configs accumulate)
**Kind:** design-smell
**Issue:** The constants file itself has a TODO at line 1 acknowledging the problem: the dependency tree between server-level and catalog-level configs isn't clearly expressed. Currently, "catalog-level" conflates Arranger core config and GraphQL transport config, because those two things are coupled in the current architecture. This is *intentionally* coupled — the design is accurate to how the system works today. But it means the constants structure will need to be rethought once the Arranger core module is extracted and the transport coupling dissolves.
**Fix:** Reorganise into at least three layers — server-level (global), transport-level (GraphQL-specific), and core-level (engine/search config) — once the core module boundary is defined. Attempting this before that extraction would be premature.
**Standalone:** no — blocked on the Arranger core module extraction in the roadmap

---

## modules/components

### Quicksearch regex as potential injection / ReDoS vector
**File:** TBD — Quicksearch component and its ES query builder (not yet implemented)
**Severity:** medium (OWASP A05: Injection)
**Kind:** security consideration
**Issue:** If Quicksearch is extended to support regex or wildcard input, user-provided patterns would be forwarded to Elasticsearch's `regexp` or `wildcard` query type. Two risks: (1) a crafted pattern could expose unintended records (injection); (2) a pathological regex can cause catastrophic backtracking in the ES query engine (ReDoS / availability attack). ES has some protections (`max_determinized_states`) but they are not a complete defence.
**Fix:** Needs design before implementation. Options: sanitize/escape input and restrict to prefix-style patterns only; document that regex support is explicitly not offered; or apply strict server-side pattern validation before forwarding to ES.
**Standalone:** needs-context — tied to the Quicksearch-in-facets roadmap item. Must be resolved in the design phase, not retrofitted.

### `integration-tests/server` missing OpenSearch client dependency
**File:** `integration-tests/server/package.json`
**Severity:** medium
**Kind:** missing dependency
**Issue:** The integration test suite already supports multiple search engines via `SEARCH_ENGINE` env var and `buildSearchClient({ client: searchEngine })`, but `@opensearch-project/opensearch` is not listed as a dependency — only `@elastic/elasticsearch`. Running the suite with `SEARCH_ENGINE=opensearch` would fail to resolve the client.
**Fix:** Add `@opensearch-project/opensearch` to dependencies. Confirm that `buildSearchClient` in `graphql-router` supports it (the `SupportedSearchClients` type implies it does). Add an OpenSearch container to the CI pod spec (or adopt testcontainers — see [roadmap §3.2](roadmap.md#32-testcontainers-for-integration-test-infrastructure)) and run the suite against both engines.
**Standalone:** mostly yes — the test harness is already wired; this is the last missing piece before OS integration tests actually run

### `release-charts` temporary publish branch
**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy` — "TEMP. Publish Charts to NPM" stage
**Severity:** low
**Kind:** design-smell
**Issue:** A `release-charts` branch triggers a separate, explicitly temporary stage to publish `modules/charts` to NPM. This is a workaround, not a solution. It runs outside the normal release process and has no change detection.
**Fix:** Fold charts publishing into the standard `release` branch publish loop, which already iterates over `modules/*` and publishes packages with version changes. Remove the `release-charts` branch and the TEMP stage.
**Standalone:** yes — small, self-contained pipeline cleanup

### SQON viewer shows multiple values in the same bubble [urgent]
**File:** `modules/components/src/` — SQON viewer component
**Severity:** high (regression)
**Kind:** bug
**Issue:** The SQON viewer is showing multiple values for a single field within the same bubble, rather than as separate bubbles as it used to. This is a regression — the previous behaviour was one value per bubble.
**Fix:** Unknown — needs investigation. Likely a rendering or data-mapping change that altered how multi-value field filters are displayed. Bisect recent changes to the SQON viewer or the SQON-to-display-model mapping.
**Standalone:** yes — UI-only bug, no server-side involvement

### Columns button disabled when no columns are shown by default
**File:** `modules/components/src/` — column selector / table component
**Severity:** low
**Kind:** bug
**Issue:** When no table columns are configured to show by default, the columns button (which lets users add/show columns) is also disabled, trapping users with no way to show any columns.
**Fix:** The button should remain enabled regardless of whether any columns are currently visible — its purpose is precisely to let users change that state.
**Standalone:** yes

---

## modules/charts

### `SupportedSearchClients` rename regression risk — PR #1066
**File:** `modules/graphql-router` — exported type `SupportedSearchClients`
**Severity:** high (will break consumers on merge)
**Kind:** naming regression
**Issue:** PR #1066 renames `SupportedSearchClients` to an incorrect name. This type is exported from `@overture-stack/arranger-graphql-router` and used by consumers including `integration-tests/server`. Merging the PR as-is will break any code referencing `SupportedSearchClients` by name.
**Fix:** Correct the name in PR #1066 before merging — the exported type must remain `SupportedSearchClients`.
**Standalone:** yes — name fix only, no logic changes

### `esToAggTypeMap` duplicated from `modules/types` (once release-charts merges)
**File:** `modules/charts/src/arranger/mapping.ts` (via commit #1064 on `release-charts`)
**Severity:** low
**Kind:** duplication
**Issue:** PR #1064 on `release-charts` fixed the `aggsType` gap by computing the GQL aggregation type locally in the charts module from `mapping.type`. The fix works, but it introduces a local `esToAggTypeMap` that duplicates `esToAggTypesMap` already defined and exported from `modules/types/src/elastic/constants.ts`. If `esToAggTypesMap` ever changes (new ES types, corrected mappings), the charts copy will silently diverge.
**Fix:** After `release-charts` merges to `main`, replace the local copy in `mapping.ts` with an import of `esToAggTypesMap` from `@overture-stack/arranger-types/elastic/constants`. One-line change.
**Standalone:** yes — mechanical import substitution, no logic changes

### TypeScript / declaration diagnostics on successful build
**File:** `modules/charts` — build output
**Severity:** medium
**Kind:** build hygiene
**Issue:** The charts build exits with a success code while emitting TypeScript and declaration file diagnostics. This is a "noisy-successful" build — CI passes, but the output is not actually clean. Published type declarations may be incomplete or incorrect.
**Fix:** Resolve the diagnostics so the build is genuinely clean, or explicitly gate `charts` out of the release path until they are fixed. Do not leave it in a state where a successful exit code masks real type errors.
**Standalone:** yes — isolated to the charts module; does not affect other packages

---

## release / publishing

### `.turbo/turbo-build.log` included in published tarballs
**Files:** `modules/graphql-router`, `modules/components` — published npm tarballs
**Severity:** medium
**Kind:** packaging hygiene
**Issue:** Built tarballs for `graphql-router` and `components` include `.turbo/turbo-build.log`. Build logs are not part of the public package API and should not ship to consumers. Other internal artifacts (test fixtures, source files not in `dist`) may have the same problem.
**Fix:** Add `files` allowlists to `package.json` for each publishable module (explicitly listing `dist`, `README.md`, `package.json`), or add `.npmignore` rules to exclude `.turbo/`, `src/`, and any generated logs. Verify with a dry-run pack after fixing.
**Standalone:** yes — mechanical packaging fix per module, no logic changes

### `file:` local dependencies in publishable packages
**Files:** `package.json` files across publishable modules (`sqon`, `types`, `graphql-router`, `components`, `charts`)
**Severity:** high (release blocker)
**Kind:** packaging bug
**Issue:** Publishable packages reference internal sibling packages via `file:` paths (e.g. `"@overture-stack/arranger-types": "file:../types"`). These work in the monorepo but break for external npm consumers, who receive a `file:` reference that resolves to nothing in their environment.
**Fix:** Before each npm publish, replace `file:` references with the actual published registry versions. This can be done at publish time as part of the release script, or managed via a tool like Changesets (which handles this automatically as part of Phase 3.1). In the interim, the release process must verify no `file:` references remain in the published tarball's `package.json`.
**Standalone:** needs-context — the clean long-term fix is [Changesets (roadmap §3.1)](roadmap.md#31-adopt-changesets-for-versioning-and-changelog-automation); the interim fix is a release validation step

---

## search-server / graphql-router boundary

### `SearchClient` vs `Client` type mismatch [done]
**Files:** `apps/search-server/src/arrangerRoutes.ts`, `apps/search-server/src/server.ts`
**Severity:** low
**Kind:** type-weakness
**Issue:** `search-server` imported `Client` from `@elastic/elasticsearch` while `graphql-router` defines its own `SearchClient` abstraction. The rest of `search-server` already used `SearchClient` via `ExternalConfigs`; only `arrangerRoutes.ts` had the stale import.
**Fix applied:** Replaced `import type { Client } from '@elastic/elasticsearch'` with `import { type SearchClient } from '@overture-stack/arranger-graphql-router'` and updated the parameter type accordingly. `@elastic/elasticsearch` is no longer imported directly in this file.
