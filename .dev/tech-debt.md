# Arranger: Technical Debt

Issues logged here when found scope-adjacent to other work. Not a priority backlog; no obligation to fix in order.
`standalone: yes` entries can be picked up freely without broader context.

---

## modules/sqon

### Relocate remaining `__tests__/` test files to co-located positions
standalone: yes
context: `modules/sqon/src/__tests__/jsonSchema.test.ts` and `schema.test.ts` are the remaining files in a `__tests__/` directory after `operators.test.ts` was moved to `src/operators/index.test.ts`. Move `jsonSchema.test.ts` alongside its source and `schema.test.ts` alongside `src/schema/index.ts` (or equivalent source file) to follow the co-location convention. The `__tests__/` directory can then be removed.

---

## build tooling

### Migrate from npm to pnpm
standalone: yes
context: npm's flat hoisting causes esbuild binary version conflicts across workspaces when multiple packages use tsup. Adding sqon as a second tsup consumer caused bundle-require's peer esbuild to be hoisted to root at a mismatched version. pnpm's strict per-package isolation would prevent this class of issue; each package sees only what it declares. Migration requires updating the Jenkins pipeline and any Dockerfiles that invoke npm.

### Upgrade tsup from 6.7.0 to 8.5.1
standalone: no
context: tsup@6.7.0 is ~2 years old. Upgrading to 8.5.1 is blocked by the npm hoisting problem above: tsup@8.5.1 brings esbuild@^0.27.0, which conflicts with tsx's esbuild@~0.28.0 and bundle-require's peer dep resolution under npm. Revisit after pnpm migration.

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
**Issue:** The MCP endpoint accepts all incoming requests with no authentication check. In a demo or staging environment accessible over a network, any agent or automated client that can reach the port can call `list-catalogues`, `get-catalogue-fields`, and `search-catalog` without restriction. There is no API key, bearer token, client certificate, or IP allowlist in place.
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

### `get-catalogue-fields` does not validate `catalogueId` against the configured allowlist

**File:** `apps/mcp-server/src/mcp/tools.ts` (`get-catalogue-fields` tool handler)
**Severity:** medium (OWASP A03: Injection; unvalidated ID forwarded into URL path; also information disclosure if Arranger hosts undeclared catalogues)
**Kind:** missing input validation
**Issue:** The `get-catalogue-fields` tool accepts any non-empty string as `catalogueId` and forwards it directly to `client.getCatalogueIntrospection(catalogueId)`, which calls `GET /introspection/{catalogueId}` on Arranger. The `ARRANGER_CATALOGUES` config declares the intended allowlist, but the tool never checks it. An adversarial agent can probe arbitrary strings: either to enumerate undeclared catalogues on the Arranger instance, or to attempt path traversal in the constructed URL (e.g. `../sqon`).
**Fix:** In the tool handler, check that `catalogueId` is present in `config.catalogues` before calling the Arranger client. Return an MCP error if it is not. The config is already available via `deps` in `registerTools`.
**Standalone:** yes; one conditional check in the tool handler; no new dependencies

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
**Issue:** Remaining instances of `catalog` must be updated to `catalogue`.

As discussed in https://github.com/overture-stack/admin/issues/182 , we have chosen the Canadian spelling `catalogue` over the American `catalog`. The MCP Server app
(`apps/mcp-server`) has been updated to reflect this change, with the exception of keys in responses returned from Arranger Server Introspection endpoints, such as `catalogs`, `catalogId`, and `catalogCount`.

When Arranger Server (`apps/search-server`) is updated to use `catalogue`, the MCP Server will need to be updated accordingly where it depends on Introspection responses.

---

## docs [URGENT: reminder every session]

### Inconsistent user-facing terminology: directory/folder, configuration/settings, docs prose

**Files:** `README.md:13`; `docs/usage/01-arranger-configs.md`; `apps/search-server/configTemplates/configs.json.schema:6,28`; `apps/search-server/src/configs/index.ts:49,53,82`; `.dev/roadmap.md:191-205` (opportunistic)
**Severity:** low (reader confusion, no functional impact)
**Kind:** terminology drift
**Issue:** Two clusters of inconsistency found during a terminology audit. Canonical definitions are now in `docs/concepts.md`.

1. "folder" vs "directory": "directory" is canonical. "folder" appears in README.md:13, `docs/usage/01-arranger-configs.md` (check after 2026-07-07 rewrite), `configTemplates/configs.json.schema:6`, and in code identifiers (buildCatalogsFromFolder, folderName) that surface in console output. Console messages in configs/index.ts mix "directories" (line 53) and "subdirectories" (lines 49, 82) for the same concept.

2. "settings" vs "configuration": "configuration" is canonical for Arranger-level concepts. "Settings" appears in configs.json.schema:28 ("Settings and limits for dataset downloads") and roadmap.md:191-205 (Arranger-level prose). Leave ES mapping file "settings" keys and ES-referencing prose untouched.

3. Docs sidebar ordering: docs/concepts.md was added with sidebar_position: 2, and overview.md and setup.md were given sidebar_position: 1 and 3. If the docs site is published from overture.bio (no sidebar.js found in this repo), that site's sidebar config also needs docs/concepts.md added.

**Fix:** (a) Docs/schema comments pass: update README.md:13, `docs/usage/01-arranger-configs.md`, configs.json.schema:28, and console strings in configs/index.ts. (b) Identifier rename pass (separate commit): buildCatalogsFromFolder -> buildCatalogsFromDirectory, folderName -> directoryName in apps/search-server/src/configs/. (c) Cross-references: add pointer to docs/concepts.md early in `docs/usage/01-arranger-configs.md`; introduce "filter clause" for leaf nodes in `docs/usage/04-sqon-in-detail.md`.
**Standalone:** yes; (a) is docs-only; (b) is a mechanical rename; (c) is a docs addition. All three independent.

### `setup.md` references `.env.arrangerDev` which no longer exists in the repo

**File:** `docs/setup.md`; step 2 of "Running the Arranger-Server"
**Severity:** high (setup guide is broken for new developers)
**Kind:** stale documentation
**Issue:** Step 2 instructs developers to `mv .env.arrangerDev .env`. That file does not exist in the repo. `apps/search-server/.env.schema` exists (the schema definition), and `.env.test` exists at the root, but there is no pre-filled `.env.arrangerDev` template to rename.
**Fix:** Either add a `.env.arrangerDev` template at the repo root, or rewrite step 2 to describe the actual setup process (e.g. copy from `.env.schema` and fill in values, or document required env vars inline). The `.env` content shown in the info callout in `setup.md` is a reasonable starting point for the template.
**Standalone:** yes; documentation or file addition only

### Network/federated search feature is undocumented

**File:** `modules/graphql-router/src/network/` (in progress)
**Severity:** medium (feature exists; operators and integrators have no documentation for it)
**Kind:** missing documentation
**Issue:** The network/federated search feature (cross-catalogue and cross-instance querying) has no published docs. "Network search" and "federated search" are synonyms for this feature; use "federated search" in consumer-facing docs.
**Fix:** Once the feature stabilises, add a `docs/usage/` page covering configuration, query patterns, and limitations. Implementation detail belongs in `.dev/docs/`.
**Standalone:** no; blocked on feature stabilisation

### Feature flags are undocumented (security features and optional functionalities)

**File:** `apps/search-server/` (env vars and config flags)
**Severity:** medium (operators cannot discover what they can enable or disable; security flags carry real risk if unknown)
**Kind:** missing documentation
**Issue:** Feature flags - including query validation limits and other optional behaviours - are not documented in `/docs`. These fall into two categories that warrant separate treatment: (1) security-relevant flags (query depth/complexity limits, rate controls) that operators should be aware of for production hardening; (2) optional functionality flags that change search behaviour but have no security dimension.
**Fix:** Add a dedicated section or page to `/docs` listing all env-var-controlled feature flags, grouped by category: security hardening vs optional functionality. Each entry should state: the env var, the default, what enabling/disabling it does, and any production recommendation.
**Standalone:** yes; docs-only addition

### Arranger Components has no published docs page

**File:** `docs/setup.md` ("Running the Arranger Components" section)
**Severity:** medium (blocks UI developers from self-serving setup)
**Kind:** missing documentation
**Issue:** `setup.md` has a "Coming Soon" placeholder for Arranger Components development setup and Storybook integration. No usage page exists for the React component library. UI developers and portal integrators have no documented starting point.
**Fix:** Add a `docs/usage/` page covering component installation, the development environment setup, and Storybook integration. Remove the "Coming Soon" placeholder in `setup.md` once that page exists.
**Standalone:** yes; independent of all other docs work

### `search-engine-integration.md` is developer-only; not published on docs.overture.bio

**File:** `.dev/docs/search-engine-integration.md`
**Severity:** medium (the permission reference is complete and useful; operators cannot reach it)
**Kind:** documentation visibility gap
**Issue:** `docs/setup.md` now links to `.dev/docs/search-engine-integration.md` for the full permissions reference. That file is only accessible in the repository; it is not published to docs.overture.bio. Operators who are not browsing the repo directly cannot reach this reference.
**Fix:** Promote `search-engine-integration.md` to a published page under `docs/usage/` (or a new `docs/operations/` section). Update the link in `setup.md` accordingly.
**Standalone:** yes; content is already complete; this is a placement and linking task only

### `02-query-processing.md` tip callout does not link to the practical SQON guide

**File:** `docs/usage/02-query-processing.md`
**Severity:** low (readability and navigation)
**Kind:** cross-link gap
**Issue:** The query processing page explains the pipeline conceptually but has no link to `03-building-sqon-queries.md`, which is the practical follow-up showing how to construct SQONs. Readers who want to go from theory to implementation have no signpost.
**Fix:** Add a tip callout at the bottom of `02-query-processing.md` pointing to `03-building-sqon-queries.md`.
**Standalone:** yes; one-line docs addition

---

## modules/sqon

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
**Issue:** Two separate implementations encode which SQON operators are valid for which field types. `buildCatalogueIntrospection.ts` has a more nuanced classification (ENUM_LIKE_TYPES, RANGE_TYPES, fallback) while `modules/sqon` returns a flat list with `applicableTo: 'all'` for non-range operators. They're consistent today but maintained independently; any future operator addition requires updating both.
**Fix:** Consolidate into `modules/sqon` as the single source of truth. Extend `getSqonFieldOperatorDetails()` to carry the same field-type classification detail that `buildCatalogueIntrospection.ts` currently encodes locally. `buildCatalogueIntrospection.ts` then becomes a thin projection over the module's data. See [roadmap: consolidate field-type-to-operator rules](roadmap.md#consolidate-field-type-to-operator-rules-into-modulessqon).
**Standalone:** yes; internal refactor, no change to API output

---

## graphql-router

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

### GraphQL introspection and field suggestions in production

**File:** `modules/graphql-router/src/graphqlRoutes.ts` (Apollo Server config)
**Severity:** medium (OWASP A02: Security Misconfiguration)
**Kind:** security bug
**Issue:** Arranger exposes field name suggestions in error messages and may allow full introspection queries in production. Both leak schema structure to clients. Introspection should be disabled in production (it is already gated by `disablePlayground`, but the introspection query and field suggestion behaviour may be independent of that flag). Possibly a side-effect of using outdated Apollo Server 3 without explicit introspection controls.
**Fix:** Explicitly disable introspection and field suggestions in production. Apollo Server 3 supports `introspection: false` and `stopSuggestions` via the `graphql` validation layer. Verify these are configured correctly and not accidentally left open. This may partially resolve itself when Apollo is replaced; but the config intent should be documented regardless.
**Standalone:** mostly yes for the immediate fix; deeper fix is part of the Apollo migration

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

### `filterNodesByNodeId` has no tests

**File:** `modules/graphql-router/src/network/utils/nodeFilter.ts`
**Severity:** low
**Kind:** missing test coverage
**Issue:** `filterNodesByNodeId` is a pure function added in PR #1076 with no accompanying tests. Key cases to cover: empty `nodesFilter` returns all nodes; populated filter returns only matching nodes; nodes with `nodeId: undefined` are excluded when a filter is provided; unknown `nodeId` values in the filter produce an empty result.
**Standalone:** yes; isolated unit test, no application changes

### `resolveAggregation` cardinality accumulation has no tests

**File:** `modules/graphql-router/src/network/aggregations/AggregationAccumulator.ts` (`resolveAggregation`)
**Severity:** low
**Kind:** missing test coverage
**Issue:** PR #1076 added cardinality accumulation to `resolveAggregation` (summing `agg.cardinality` across nodes, with `undefined` passthrough). The existing accumulation logic for `buckets` and `bucket_count` had no tests before this PR; the cardinality path now adds a third untested accumulation branch. Cases to cover: cardinality sums correctly across multiple nodes; a node with `cardinality: undefined` does not contribute to the sum; an empty aggregations list produces `cardinality: 0`.
**Standalone:** yes; unit tests only, no application changes

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
**Issue:** `getESAliases` has two distinct code paths - alias found (returns the backing index name) and no match (returns `esIndex` as-is) - neither of which has a unit test. Mock the `cat.aliases` response to cover both branches.
**Standalone:** yes; unit test only, no application changes

### No unit tests for `getAllData` pagination

**File:** `modules/graphql-router/src/utils/getAllData.js`
**Severity:** low (missing test coverage)
**Kind:** missing test coverage
**Issue:** `getAllData` uses `search_after` cursor pagination across batches; neither the cursor handoff between pages nor the single-page short-circuit (all results fit in one batch) has a unit test.
**Standalone:** yes; unit test only; mock the `esClient.search` call

### No unit tests for `resolveSetsInSqon` set expansion

**File:** `modules/graphql-router/src/mapping/hackyTemporaryEsSetResolution.js`
**Severity:** low (missing test coverage)
**Kind:** missing test coverage
**Issue:** `resolveSetsInSqon` has two paths - SQON contains no `set_id:` values (no-op, returns SQON unchanged) and SQON contains `set_id:` values (expands to stored IDs via an ES search). Neither path has a unit test.
**Standalone:** yes; but note the file also carries the `hackyTemporaryEsSetResolution` tech-debt entry; evaluate for removal during Sets full-feature implementation rather than investing deeply in tests for code that may be replaced

### No unit tests for `convertToSqon` or other `network/utils/` functions

**Files:** `modules/graphql-router/src/network/utils/sqon.ts`, `modules/graphql-router/src/network/utils/gql.ts`, `modules/graphql-router/src/network/utils/promise.ts`
**Severity:** medium
**Kind:** missing test coverage
**Issue:** `convertToSqon` is a pure function at a user-input boundary: it parses an unknown value and returns `Result<SqonNode, { INVALID_SQON: string }>`. Every incoming SQON passes through it, making it security-relevant, yet it has zero test coverage. The other two utils files (`gql.ts`, `promise.ts`) are also untested.
**Fix:** Unit tests for `convertToSqon` covering: valid SQON returns `success(SqonNode)`; invalid SQON (wrong shape, missing `op`) returns failure with `INVALID_SQON`; null/undefined input returns failure; JSON string input is accepted. Add tests for `gql.ts` and `promise.ts` once their exported surface is confirmed non-trivial.
**Standalone:** yes; pure functions, no mocking required

### No unit tests for network resolvers

**Files:** `modules/graphql-router/src/network/resolvers/` (aggregations.ts, fetch.ts, networkNode.ts, query.ts, response.ts)
**Severity:** medium
**Kind:** missing test coverage
**Issue:** The entire network resolver layer has no tests. This is the core async multi-node query execution path: aggregation response resolving, remote node data fetching, network node response building, query construction, and response transformation. Bugs here affect all multi-catalogue network searches silently.
**Fix:** Unit tests with mocked network node responses. The pure transformation files (`response.ts`, `networkNode.ts`, `query.ts`) can be tested directly. `fetch.ts` requires HTTP-level mocking (e.g. `undici MockAgent` or similar). Cover: single-node success; partial node failure (one down, others succeed); empty response; aggregation accumulation across nodes.
**Standalone:** partial; transformation functions are standalone; `fetch.ts` depends on establishing the HTTP mock pattern first

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

---

## modules/types

### No unit tests for `tools/` utilities or `networkAggregationConfigUtils`

**Files:** `modules/types/src/tools/stringFns.ts`, `modules/types/src/tools/typeFns.ts`, `modules/types/src/configs/networkAggregationConfigUtils.ts`
**Severity:** low
**Kind:** missing test coverage
**Issue:** All three files are exported from the package and used across the monorepo but have zero test coverage. `stringFns.ts` and `typeFns.ts` are utility and type guard functions where a regression would propagate silently to every consumer. `networkAggregationConfigUtils.ts` contains non-trivial domain logic for network aggregation config setup.
**Fix:** Co-located unit tests (e.g. `stringFns.test.ts` alongside `stringFns.ts`) covering each exported function. Prioritize `networkAggregationConfigUtils` as the highest-complexity target.
**Standalone:** yes

### Config constants need reorganization (blocked on architecture work)

**File:** `modules/types/src/configs/constants.ts`
**Severity:** medium (grows over time as configs accumulate)
**Kind:** design-smell
**Issue:** The constants file itself has a TODO at line 1 acknowledging the problem: the dependency tree between server-level and catalog-level configs isn't clearly expressed. Currently, "catalog-level" conflates Arranger core config and GraphQL transport config, because those two things are coupled in the current architecture. This is _intentionally_ coupled; the design is accurate to how the system works today. But it means the constants structure will need to be rethought once the Arranger core module is extracted and the transport coupling dissolves.
**Fix:** Reorganize into at least three layers (server-level global, transport-level GraphQL-specific, and core-level engine/search config) once the core module boundary is defined. Attempting this before that extraction would be premature.
**Standalone:** no; blocked on the Arranger core module extraction in the roadmap

---

## modules/components

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
**Fix:** Add `@opensearch-project/opensearch` to dependencies. Confirm that `buildSearchClient` in `graphql-router` supports it (the `SupportedSearchClients` type implies it does). Add an OpenSearch container to the CI pod spec (or adopt testcontainers; see [roadmap §3.2](roadmap.md#32-testcontainers-for-integration-test-infrastructure)) and run the suite against both engines.
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

### SQON viewer shows multiple values in the same bubble [urgent]

**File:** `modules/components/src/SQONViewer/index.jsx:63` (value construction), `helpers.tsx` (`ValueCrumb`, truncation/tooltip)
**Severity:** high (regression)
**Kind:** bug
**Issue:** Root cause confirmed via bisect to commit `87b9c1da` (PR #923, "upgrade to 2025 standards"). The value array construction was changed from `const value = [].concat(valueSQON.content.value || [])` to `const value = valueSQON.content.value ? [valueSQON.content.value] : []`. The old form flattened `content.value` into a real array of N entries regardless of whether it was already an array or a bare scalar. The new form always wraps `content.value` in a single-element array, so a multi-value filter's array (e.g. `['LOSH', 'TNTS']`) becomes a one-element array containing that array, not a two-element array of strings.

Downstream effects, both visible in production (demo.overture.bio):
- `hasMultipleValues` (`value.length > 1`) is now always `false` for multi-value filters, since `value` is always length 1. This also breaks the operator label at line 88 (`op === 'in' && hasMultipleValues ? op : 'is'`): a genuine `in` filter with multiple values now displays as `is` instead of `in`, and the surrounding parentheses (`SQONValueGroup`, gated on `hasMultipleValues`) never render.
- `ValueCrumb` (`helpers.tsx`) receives the whole array as a single `value` instead of one call per entry, so all values are joined into one bubble instead of one bubble per value.
- The per-value character-limit truncation and hover-tooltip in `ValueCrumb` still fire, but now against the comma-joined multi-value string rather than each individual value, so a long list is silently truncated with no per-value "x" to remove one value at a time; the tooltip becomes the only way to read the full list.

**Fix:** Revert `index.jsx:63` to flatten rather than wrap: `const value = [].concat(valueSQON.content.value ?? [])`. This restores one-bubble-per-value rendering, the `in`/`is` label distinction, the enclosing parentheses, and per-value truncation. **Tests are a required part of this fix, not optional follow-up**: this exact regression shipped silently once already because no test covered the rendering path. Add a co-located `SQONViewer/index.test.jsx` covering at minimum: an `in`/multi-value filter renders N separate value bubbles with the `in` label and parentheses; a single-value filter renders one bubble with the `is` label and no parentheses; a multi-value filter past the truncation limit still renders N bubbles (not one truncated joined string). Do not consider this entry resolved until the fix lands with these tests in the same change.
**Standalone:** yes; UI-only bug, no server-side involvement; single-line fix plus tests

### No rendering-level unit test coverage in `modules/components`; SQONViewer is the natural starting point

**Files:** `modules/components/src/` (all rendering components); confirmed via survey: only `SQONViewer/utils.test.js`, `SQONViewer/__tests__/utils.test.js`, `TextFilter/__tests__/TextFilter.test.js`, `utils/__tests__/splitString.test.js`, `utils/uri/__tests__/uri.test.js` exist in the entire module
**Severity:** medium (regressions in rendering logic ship silently; the SQON viewer bubble bug above is a direct instance)
**Kind:** missing test coverage
**Issue:** Across the whole `modules/components` package, only five test files exist, and none exercise actual component rendering; all are pure-function/utility tests. No component that renders JSX has any test. This is why the SQON viewer bubble regression (see entry above) shipped and went unnoticed for over a year: `index.jsx`'s rendering logic had zero coverage. Separately, `SQONViewer/__tests__/utils.test.js` (old-style, non-co-located) contains a no-op assertion (`it('should return the query if no base sqon', () => { expect(false).toBe(false); })`) that passes regardless of the code under test; existing coverage is thinner than the file count suggests. `SQONViewer/utils.test.js` (co-located) and `SQONViewer/__tests__/utils.test.js` (old-style) both exist side by side and test different functions, not duplicates, but the latter should be relocated per the [co-location convention](#inconsistent-unit-test-file-placement).
**Fix:** Use the SQON viewer bubble fix above as the pilot: add `SQONViewer/index.test.jsx` with real rendering assertions (via Testing Library, already available for React 18+ components). Fix the no-op test in `__tests__/utils.test.js` while relocating it to co-located `utils.test.js` alongside the other `addInSQON`/`toggleSQON`/`mergeQuery` tests it actually covers (careful: this would collide with the existing co-located `utils.test.js`, which tests `isWildcardFilter` from the same `utils.js`; merge into one file rather than overwriting). Once the pattern is established, extend to other high-traffic rendering components (Table, Aggs family) opportunistically as they're touched.
**Standalone:** yes; the SQONViewer pilot is standalone; broader extension to other components is opportunistic, not a blocking prerequisite

### Columns button disabled when no columns are shown by default

**File:** `modules/components/src/`; column selector / table component
**Severity:** low
**Kind:** bug
**Issue:** When no table columns are configured to show by default, the columns button (which lets users add/show columns) is also disabled, trapping users with no way to show any columns.
**Fix:** The button should remain enabled regardless of whether any columns are currently visible; its purpose is precisely to let users change that state.
**Standalone:** yes

---

## modules/charts

### `SupportedSearchClients` rename regression risk (PR #1066)

**File:** `modules/graphql-router`; exported type `SupportedSearchClients`
**Severity:** high (will break consumers on merge)
**Kind:** naming regression
**Issue:** PR #1066 renames `SupportedSearchClients` to an incorrect name. This type is exported from `@overture-stack/arranger-graphql-router` and used by consumers including `integration-tests/server`. Merging the PR as-is will break any code referencing `SupportedSearchClients` by name.
**Fix:** Correct the name in PR #1066 before merging; the exported type must remain `SupportedSearchClients`.
**Standalone:** yes; name fix only, no logic changes

### `esToAggTypeMap` duplicated from `modules/types` (once release-charts merges)

**File:** `modules/charts/src/arranger/mapping.ts` (via commit #1064 on `release-charts`)
**Severity:** low
**Kind:** duplication
**Issue:** PR #1064 on `release-charts` fixed the `aggsType` gap by computing the GQL aggregation type locally in the charts module from `mapping.type`. The fix works, but it introduces a local `esToAggTypeMap` that duplicates `esToAggTypesMap` already defined and exported from `modules/types/src/elastic/constants.ts`. If `esToAggTypesMap` ever changes (new ES types, corrected mappings), the charts copy will silently diverge.
**Fix:** After `release-charts` merges to `main`, replace the local copy in `mapping.ts` with an import of `esToAggTypesMap` from `@overture-stack/arranger-types/elastic/constants`. One-line change.
**Standalone:** yes; mechanical import substitution, no logic changes

### `generateChartsQuery` network path has no tests

**File:** `modules/charts/src/query/generateCharts.ts`
**Severity:** low
**Kind:** missing test coverage
**Issue:** PR #1076 added the network query generation branch to `generateChartsQuery` (local query, network aggregations, and network nodes independently enabled/disabled by `queryFields`, `networkQueryFields`, and `isRequireNetworkSearch`). The existing local-only path was also untested. Key cases: no fields and no network requirement returns `null`; local fields only produces no `network` block; `isRequireNetworkSearch` without network aggregation fields produces a `network { nodes }` block without `aggregations`; both local and network fields appear together in one query.
**Standalone:** yes; unit tests only, no application changes

### TypeScript / declaration diagnostics on successful build

**File:** `modules/charts`; build output
**Severity:** medium
**Kind:** build hygiene
**Issue:** The charts build exits with a success code while emitting TypeScript and declaration file diagnostics. This is a "noisy-successful" build; CI passes, but the output is not actually clean. Published type declarations may be incomplete or incorrect.
**Fix:** Resolve the diagnostics so the build is genuinely clean, or explicitly gate `charts` out of the release path until they are fixed. Do not leave it in a state where a successful exit code masks real type errors.
**Standalone:** yes; isolated to the charts module; does not affect other packages

### Chart tooltip cannot pluralize custom labels

**File:** `modules/charts/src/components/charts/Tooltip.tsx:38`
**Severity:** low (cosmetic; visible to any operator using a custom label)
**Kind:** incomplete implementation
**Issue:** Added in PR #1074. The tooltip appends `'s'` for counts greater than one (e.g. "Records" vs "Record") using a simple string suffix. The TODO in the file notes that a `pluralize` library call does not work when a custom label is applied via CSS; so operators who override the label text via styling get a suffix on the wrong content. The root cause is that label customization is CSS-based rather than prop-based, leaving no programmatic hook for pluralization logic.
**Fix:** Replace the CSS-based label customization pattern with a `label` prop accepting a singular/plural string pair (e.g. `{ singular: 'Record', plural: 'Records' }`). The pluralization then happens in the component against the prop value rather than against CSS output. The default values maintain the current "Record"/"Records" behaviour.
**Standalone:** yes; component-level change, no server involvement

### Bar chart `SUPPRESSION_INCREMENT_VALUE` is not configurable

**File:** `modules/charts/src/components/charts/Bar/View.tsx:10`
**Severity:** low (cosmetic; hardcoded visual increment for suppressed zero-value bars)
**Kind:** missing config option
**Issue:** Added in PR #1074. Zero-value bar suppression uses a hardcoded `SUPPRESSION_INCREMENT_VALUE = 0.2` to render a small visible bar for data values of exactly zero (so the bar is not invisible). The TODO in the file acknowledges this should be a configurable prop. Different chart contexts may need different visual increments depending on axis scale and bar density.
**Fix:** Add a `suppressionIncrement` prop to `BarChartProps` (default `0.2`). Pass it through `BarChart.tsx` to `View.tsx` and replace the module-level constant.
**Standalone:** yes; additive prop, no server involvement

---

## release / publishing

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

---

### `file:` local dependencies in publishable packages

**Files:** `modules/types/package.json`, `modules/graphql-router/package.json`, `modules/components/package.json`
**Severity:** high (confirmed consumer-facing breakage)
**Kind:** packaging bug
**Issue:** Three publishable packages reference sibling packages via `file:` paths in `dependencies` (e.g. `"@overture-stack/arranger-types": "file:../types"`). npm encodes these verbatim in the published tarball's `package.json`. External consumers get errors like `Package "" refers to a non-existing file '"/Users/.../types"'` because the publishing machine's local paths do not exist in the consumer's environment. `modules/sqon` and `modules/charts` are clean; no `file:` deps.

**Interim fix (implemented):** `scripts/fix-workspace-deps.mjs` rewrites `file:` deps to `^<sibling-version>` ranges before each `npm publish` call in the Jenkins pipeline, then restores `package.json` from git. Local dev is unchanged; `file:` refs continue to work via npm workspaces symlinks. The pipeline publish loop calls the script and restores after each package. Note: alphabetical publish order (`components` and `graphql-router` before `types`) means there is a short window where those packages reference a `types` version not yet on npm. Acceptable for coordinated release runs; Changesets eliminates it by publishing in dependency order.

**Long-term fix: two separate tools, both needed:**

- **Changesets (roadmap Phase 3.1):** Handles version management, changelog generation, and publishing in dependency order. Replaces the manual version-bump commit and the current pipeline publish loop. Does not on its own solve the `file:` encoding problem, but it handles it as part of its version-replacement step when combined with pnpm.

- **pnpm workspace: protocol (roadmap Phase 3.3):** Replaces `file:../x` deps with `workspace:*`. In development, pnpm resolves `workspace:*` to the local package (same behaviour as `file:`). At `pnpm publish`, pnpm automatically rewrites `workspace:*` to the actual version range in the tarball. This eliminates the problem at the package manager level, making the fix-and-restore script unnecessary.

**When Changesets lands (Phase 3.1):** Delete `scripts/fix-workspace-deps.mjs` and remove the `node scripts/fix-workspace-deps.mjs` and `git checkout` lines from the Jenkins publish loop. Changesets' `changeset version` step rewrites `file:` deps to real version ranges before publishing, making the interim script redundant. `scripts/verify-pack.mjs` stays.

**When pnpm lands (Phase 3.3):** Replace all `file:../x` dep specs with `workspace:*` across every `package.json` in the repo (publishable modules, `apps/`, `integration-tests/`). pnpm replaces `workspace:*` with real version ranges at publish time automatically. `scripts/verify-pack.mjs` already handles this; no changes needed there.

**Standalone:** no; depends on Changesets (Phase 3.1) for the clean fix; pnpm (Phase 3.3) for the workspace: migration.

---

## apps/search-server

### No unit tests for catalog config loading or `catalogId`

**Files:** `apps/search-server/src/configs/index.ts`, `apps/search-server/src/configs/catalogId.ts`, `apps/search-server/src/configs/fromFiles/` (4 files), `apps/search-server/src/configs/fromEnv/` (3 files)
**Severity:** high
**Kind:** missing test coverage
**Issue:** The catalog loading logic - recursing subdirectories, aggregating config files, generating unique IDs - has no tests. This is startup-critical: bugs cause startup failures or silent misconfiguration in multicatalog deployments. `catalogId.ts` tracks ID uniqueness across loads but is also untested. `fromFiles/` and `fromEnv/` parsing has no coverage either.
**Fix:** Unit tests using a temporary directory fixture for flat (single-catalog) and nested (multicatalog) layouts; error handling on malformed config files; unique ID generation and collision detection in `catalogId.ts`; env var aggregation in `fromEnv/`.
**Standalone:** yes; no running server required; mock the filesystem with a temp directory

### No README

**File:** `apps/search-server/`; no `README.md` present
**Severity:** medium (discoverability and onboarding gap; especially relevant for teams building on or deploying Arranger)
**Kind:** missing documentation
**Issue:** `apps/search-server` has no README. It is the primary runnable application in the monorepo (the thing operators deploy) but there is no document explaining how to run it, what env vars it accepts, how the config directory is structured, or how it relates to `modules/graphql-router`. The `.env.schema` file partially serves this purpose, but only for env vars, and is not discoverable without knowing to look there.
**Fix:** Add `apps/search-server/README.md` covering: what the app is, how to run it (`npm run server` from repo root), the env var reference (pointing at `.env.schema` for full schema, with the most important vars inline), the configuration directory structure (flat = single catalogue; subdirectories = multicatalogue), and a pointer to the `graphql-router` README for custom integrations.
**Standalone:** yes

---

## search-server / graphql-router boundary

### `SearchClient` vs `Client` type mismatch [done]

**Files:** `apps/search-server/src/arrangerRoutes.ts`, `apps/search-server/src/server.ts`
**Severity:** low
**Kind:** type-weakness
**Issue:** `search-server` imported `Client` from `@elastic/elasticsearch` while `graphql-router` defines its own `SearchClient` abstraction. The rest of `search-server` already used `SearchClient` via `ExternalConfigs`; only `arrangerRoutes.ts` had the stale import.
**Fix applied:** Replaced `import type { Client } from '@elastic/elasticsearch'` with `import { type SearchClient } from '@overture-stack/arranger-graphql-router'` and updated the parameter type accordingly. `@elastic/elasticsearch` is no longer imported directly in this file.
