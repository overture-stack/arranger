# Arranger Roadmap

This document covers two categories of planned work: **product and architecture** (features, structural evolution, technical modernization) and **CI/CD and release process** (pipeline, versioning, tooling). Both matter; neither is more "real" than the other.

**Status:** items are open/planned unless marked `[done]` or `[in progress]`.

---

## Architecture

### Config plan/preview CLI

_Priority: high. Sequenced at the top: no open design question blocks starting it._

A CLI that diffs a proposed catalogue configuration against a live ES/OS mapping and reports what would change (facets, columns, missing fields, validation errors) without starting the server or writing to the cluster. Absorbs the config-validation item rather than duplicating its Zod work.

[Detail: rationale, open design questions, read-only credential requirement](docs/atlas/roadmap/config-tooling.md#config-planpreview-cli)

### Mapping-drift detector (research)

_Priority: low. Research-first, and possibly not a separate implementation at all: see the scoping note below before treating this as new tooling._

The problem this is aimed at: a catalogue's facets, columns, and searchable fields come from configuration files (`extended.json`, `facets.json`, `table.json`), which are supposed to match the real fields in the live ES/OS index. Nothing currently checks that they still agree. Concrete failure mode: an operator's upstream indexing pipeline (for example Maestro) adds a new field to the index; nobody remembers to add it to the catalogue's configuration; the field is then silently invisible in Arranger, with no error and no warning. The reverse also happens: a field is removed or renamed upstream while a facet still references it, and that facet quietly breaks.

**Scoping note:** this is, mechanically, the same comparison the Config plan/preview CLI item above already has to make (live index mapping versus configuration files). The likely right answer is that this does not need its own tool: running that CLI on a schedule against the currently-deployed configuration, with no proposed change, and alerting if it reports any diff, is a mapping-drift detector. This entry mainly exists to record that use case (scheduled, automatic drift-checking, not just pre-deploy validation) so it isn't lost when the CLI is scoped. Whoever picks up the CLI work should read this and decide whether a "drift-check mode" (for example, a machine-readable exit code or JSON diff suitable for a cron job and an alert) is worth designing in from the start, rather than building a second tool later.

**Distinct from the typed client SDK item further below:** despite sounding similar (both are "things that are supposed to match can silently drift apart"), they check different pairs of things for different people. This item is about Arranger's own configuration staying honest about the real data underneath it, an operator's concern. The typed client SDK is about a consumer's code staying honest about Arranger's current API, a downstream developer's concern. Neither substitutes for the other.

---

### OpenSearch-first migration

_Priority: high._

Make OpenSearch the primary supported engine with ES as a supported variant, so a fresh clone gets OpenSearch by default. The `SearchClient` abstraction and the OpenSearch client dependency already exist; the gaps are `integration-tests/server`'s missing client, no `opensearch` service in `docker-compose.yml`, an ES-only CI pod, and an ES client two majors stale.

[Detail: scope, corrected status, CI pod intent](docs/atlas/roadmap/opensearch-migration.md)

### GraphQL server migration (away from Apollo)

_Priority: high. prerequisite for Keycloak auth implementation._

Apollo Server 3 is end-of-life. Upgrading to Apollo Server 4 is not the right move; Apollo is opinionated about its hosting environment (it assumes Express-style middleware, has its own context and plugin APIs) in ways that conflict with the longer-term direction of making Arranger framework-agnostic.

**Sequencing:** This item is the second step of a three-step chain driven by a pentest audit finding:

1. **Disable introspection in Apollo v3 (done):** Apollo's `introspection` option on both `ApolloServer` constructors in `graphqlRoutes.ts` is now gated by the `disableGraphQLIntrospection` feature flag (`introspection: !disableGraphQLIntrospection`), which defaults to disabled in production via `NODE_ENV` and can also be set explicitly per catalogue or via env var. Apollo v4+ disables introspection in production automatically; this flag aligns v3 behaviour with that convention, with the added benefit of being explicitly overridable. Field name suggestions in GraphQL error responses (a separate leak from introspection, on its own validation code path) are now also stripped via a custom `formatError` in `createEndpoint` (2026-07-20); Apollo v4 handles this automatically, so this becomes redundant (not harmful) once the migration lands.
2. **Migrate to graphql-yoga (this item):** Clean foundation before auth is built on Apollo-specific APIs.
3. **Keycloak bearer token auth (follows):** Implemented as Express middleware - library-agnostic, portable across the migration. Direct Keycloak JWT validation while Usher planning continues. See [Auth and field/record-level access control](#auth-and-fieldrecord-level-access-control).

The leading replacement candidate is **graphql-yoga** (maintained by The Guild, who also maintain `@graphql-tools`, already used in this repo). It runs on any JS runtime, integrates with Express without requiring it, supports the same schema-first approach the codebase uses, and is actively maintained. This is a research-confirmed candidate, not a final decision.

Done when: Apollo is removed from `graphql-router`, the type errors currently masked in `graphqlRoutes.ts` are resolved, and the `buildContext` API has a clear, well-typed contract.

### Arranger core module extraction

_Priority: medium-high. The central piece of the architecture evolution._

The search and aggregation logic currently living inside `graphql-router` is coupled to GraphQL and Express in ways that aren't inherent to the logic itself. The goal is to extract this into a separate, framework-agnostic module (working name `arranger-core`, though the final name is TBD) that exposes pure query-building and result-mapping functions with no transport dependencies.

`graphql-router` would then become a thin adapter: it takes the GraphQL query, calls core, and shapes the response. This mirrors how `search-server` is already separated from `graphql-router`; that separation was a deliberate early step toward this goal.

The practical benefit: integrators who want Arranger's search capabilities in a REST API, gRPC service, or any other context could use `arranger-core` directly without pulling in GraphQL dependencies.

_Design work needed: define the interface between core and transport. The config system (currently server-level vs catalog-level) will also need to be revisited once the transport coupling is removed; see [tech-debt: config constants reorganization](tech-debt.md#config-constants-need-reorganization-blocked-on-architecture-work). Custom columns and custom facet groups (in the Features section) depend on this work._

### Auth and field/record-level access control

**Subsystem docs:** design, sequencing, and the scoped defect index now live in [`.dev/docs/arranger-auth/`](docs/arranger-auth/index.md). Key decision recorded there: enforcement belongs at the query-building boundary rather than the transport boundary, so the planned Beacon and REST adapters inherit it instead of reimplementing it, and the Usher plugin is a translator only. Three defects block building on the current seam, including a confirmed export-path bypass of `getServerSideFilter`.

_Priority: medium. Blocked on the Overture ABAC design and the core module boundary._

Arranger has no notion of who is querying or what they may see; server-side filters are an IoC escape hatch, not auth. Two safety defaults are not open questions and are built in from day one: fail closed on any enforcement failure, and every denial emits a structured log entry.

[Detail: the open design questions, the Usher-owned decisions, and the `nestingPrefix` field-level incompatibility](docs/atlas/roadmap/auth-and-access-control.md#auth-and-fieldrecord-level-access-control)

### Transport layer abstraction

_Priority: long-term. Depends on core module extraction._

Once `arranger-core` exists, `graphql-router` becomes one of potentially several transport adapters. Other transports (a REST adapter, for instance) should be buildable by anyone without forking or duplicating core logic. The interface contract between core and transport is the design work that needs to happen first.

This is a directional goal, not an actionable item yet.

### Deprecate `sqon-builder`

_Priority: next. Absorption into `modules/sqon` is complete (builder API, reduceSqon, filter manipulation, from(), all operators, correct type boundary). Remaining: formal deprecation and removal._

Steps:

1. Publish a final `@overture-stack/sqon-builder` version with a deprecation notice pointing consumers at `@overture-stack/sqon`.
2. Remove `sqon-builder` as a dependency from this monorepo.

**MCP surface unification** (follow-on): `modules/sqon` now owns all operator metadata via `getSqonFieldOperatorDetails()`. The `get_sqon_schema` MCP tool still returns a hand-maintained prose cheat sheet; the `arranger://introspection/sqon` resource returns raw JSON. Both should derive from `getSqonFieldOperatorDetails()` so they stay in sync automatically as operators are added. Scope this as part of the deprecation PR or immediately after.

### Consolidate field-type-to-operator rules into `modules/sqon`

_Priority: medium. Cleanup work, doable independently._

The logic for mapping ES field types to valid SQON operators currently exists in two separate places: `getValidFieldOperators()` in `modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts`, and `getSqonFieldOperatorDetails()` in `modules/sqon`. These encode the same domain knowledge independently and will drift as operators or types are added.

The goal is to make `modules/sqon` the single source of truth. `getSqonFieldOperatorDetails()` should be extended to carry the field-type classification detail currently encoded only in `buildCatalogueIntrospection.ts` (the ENUM_LIKE_TYPES / RANGE_TYPES distinction, boolean handling, etc.). `buildCatalogueIntrospection.ts` then becomes a thin projection over that data rather than a parallel implementation.

Done when: `buildCatalogueIntrospection.ts` no longer contains its own operator-applicability logic; `modules/sqon` exports all the rules needed for any consumer to determine valid operators for a given ES field type.

_Aligns with `sqon-builder` monorepo integration; if/when `sqon-builder` merges into `modules/sqon`, this work should be done first or alongside to avoid tripling the implementations._

### Network aggregation as a separate concern

_Priority: medium. Currently coupled to graphql-router, should be its own bounded layer._

The federated "network search" feature (querying multiple Arranger nodes and aggregating their results) is currently wired directly into `graphql-router`. It should eventually be extracted as its own module or clearly bounded layer, independent of both the core and the transport. This would allow the network layer to evolve without touching the local search path, and would make it possible to federate over non-GraphQL transports in the future.

_Needs design work before implementation. Not yet scoped._

### search-server route organization

_Priority: low. Structural improvement, no behaviour change._

`apps/search-server/src/server.ts` currently wires all route concerns directly in the main server setup. As the server grows (health checks, introspection, arranger routes), route registration should be organized into a `routes/` directory:

- `routes/arranger.ts`: catalogue router setup (currently `arrangerRoutes.ts`)
- `routes/health.ts`: health/ping endpoint
- `routes/introspection.ts`: introspection endpoints (already partially separated)
- `server.ts` composes these: each route module exports a factory and `server.ts` mounts them

The refactor is purely structural; no behaviour changes, no new features. `arrangerRoutes.ts` at the `src/` root was the natural first step; `routes/` becomes the convention once there are multiple route files.

_Standalone: yes. Small PR, no upstream dependencies._

### Multicatalog catalogue lifecycle and metadata

_Priority: medium-high. Core mechanism implemented 2026-07-24._

A catalogue with a missing or unreachable index no longer crashes the server: `Promise.allSettled` per catalogue, a stub router for failures, a machine-readable `error.code`, and a server-wide aggregate status behind `GET /ready`. Confirmed against a real deployment where 4 of 5 catalogues were down.

Still open: nothing produces the `disabled` or `loading` statuses yet (and only `available`/`failed` exist in the type today); admin-gating the server-wide listing once Usher lands; a Prometheus endpoint for per-catalogue history (see Ideation).

Full detail, including the status vocabulary, endpoint semantics, and why liveness stays catalogue-blind: [atlas: multicatalogue lifecycle](docs/atlas/roadmap/multicatalogue-lifecycle.md).

### Per-catalogue config reload without full server restart

_Priority: medium. To be reviewed before committing to a design._

Today, a catalogue config change triggers a full server restart: the Helm chart detects md5 checksum drift against the deployed config and restarts the whole process. Kubernetes rolling updates keep the previous pod serving traffic until the new one is ready, so this costs nothing in a k8s deployment, but a local or smaller setup without rolling updates takes full downtime on any single catalogue's config change.

Investigation found per-catalogue state (ES/OS client, GraphQL schema, Express router) is already isolated and keyed by catalogue ID inside `arrangerRouter()` (`modules/graphql-router/src/router.ts:40-127`), built fresh per catalogue with no shared caching. The actual gap is mounting: `apps/search-server/src/arrangerRoutes.ts:58-61` mounts each catalogue's router directly on the parent Express router (`router.use(...)`), which has no mutable registry to reach back into once mounted; Express bakes the sub-router into its internal middleware stack.

Two carve-outs would need care in any implementation: the optional shared `esClient` injection path (`apps/search-server/src/server.ts:14,64`) forces one client onto all catalogues if used, and the introspection router map (`apps/search-server/src/introspection/index.ts:9-43`) would need its entry swapped in lockstep with any router swap, or it could keep referencing a torn-down catalogue.

**Proposed incremental path, not yet committed to:**

1. Manual reload trigger for a single catalogue (for example an admin-gated `POST /:catalogId/reload`) that re-runs `buildCatalogueRouter()` and swaps its entry in a `Map<catalogId, Router>` behind a thin dereferencing middleware, replacing Express's static mount.
2. Opt-in file-watching (for example `chokidar`) on each catalogue's config directory, calling the same reload path automatically; this is where the md5-checksum logic currently living in the Helm chart could move into the app itself.
3. Coordinate with "Multicatalog catalogue lifecycle and metadata" above: a catalogue mid-reload is a natural fit for the `available`/`failed`/`disabled` status model already being planned there, so a client hitting the catalogue during a reload gets a real status rather than a race condition.

_To be reviewed before committing to a design. Related: Multicatalog catalogue lifecycle and metadata; Per-catalogue search engine credentials via env vars._

### Per-catalogue search engine credentials via env vars

_Priority: medium. Config plumbing gap, not a design question._

File-based config already supports per-catalogue search-engine credentials; env-var config reads one global set. Close the asymmetry, and `NESTING_PREFIX` along with it.

[Detail: where each path resolves today, and the second confirmed instance](docs/atlas/roadmap/config-tooling.md#per-catalogue-search-engine-credentials-via-env-vars)

### Arranger config separation

_Priority: medium-high. Blocked on core module extraction._

Split the currently-conflated config model into server, transport, and core layers, with UI config separated out, each property documented and validated at its boundary.

[Detail: why the layers are currently coupled and what unblocks this](docs/atlas/roadmap/config-tooling.md#arranger-config-separation)

### Config validation with structured errors and tests

_Priority: medium. Usability and reliability improvement, doable without waiting for config separation._

Config loading in both the server (`apps/search-server`) and within Arranger's internal handling currently has no runtime validation. Invalid or missing values fail silently or produce confusing runtime errors far from the source of the problem. The fix is schema validation at the config boundary: reject bad configs early with a clear, actionable message identifying exactly what is wrong and where.

Scope:

- **Server config** (`apps/search-server`): env vars and server-level settings; validate that required values are present and correctly typed on startup. Fail fast with a human-readable error rather than surfacing a cryptic crash later.
- **Catalog config** (the per-catalog JSON loaded by Arranger): validate against the expected schema before the catalog is registered. Where a value is missing but has a safe default, warn rather than error.
- **Validation library:** Zod is the leading candidate; it produces typed output and legible error messages. The config separation roadmap entry already assumes Zod; this item just brings validation forward to the current config shape.
- **Tests:** validation logic should be tested directly, both the happy path and representative error cases (missing required field, wrong type, unknown key).

**Security framing:** silently falling back to a partial or default config when validation fails is an OWASP A08:2025 (Software or Data Integrity Failures) risk, not just a UX rough edge. The correct behaviour on invalid config is to refuse to start with the validation error, never to silently apply a partial or best-effort config and continue running in an unintended state.

_This work is independent of the config separation effort and is not blocked on it; it validates configs in their current shape. When config separation lands, the validation schemas will need updating to reflect the new layer boundaries, but that is an incremental change, not a rewrite._

### Redesign the document model (hits / edges / nodes)

_Priority: medium. Design-first, breaking API change._

The current response model (`hits { total, edges { node { ... } } }`) is a GraphQL convention borrowed from the Relay cursor-based pagination spec. It is verbose, unfamiliar to users not steeped in Relay, and maps awkwardly to the flat document structure of most Arranger catalogs.

The goal is a more declarative, JSON-friendly model that maps closer to actual data shapes while remaining model-agnostic. This is a breaking change to the GraphQL API surface and affects any consumer of Arranger. It should be designed in coordination with the core module extraction, since the core module's output contract defines what "a result" looks like before it reaches any transport layer.

**Related, worth designing together:** the same question applies to aggregations specifically. The `__`-joined flat aggregation name (e.g. `biomarker__ca19_9_level`, see `mapping/utils/graphqlNameFns.ts` in `modules/types`) exists because `mappingToAggsType`'s Aggregations type folds every ES `object`-typed sub-path into one flat field list; only ES `nested`-typed fields get their own separate `...Aggregations` type today. Nothing in GraphQL requires this: a fully hierarchical Aggregations type per object-nesting level (mirroring what the main scalar/nested schema already does) would eliminate the need to flatten, and encode, a dotted path into a single name at all. This is a redesign of `mappingToAggsType`/`mappingToNestedTypes`'s aggregation branch, not a quick fix, but both this and the hits/edges/nodes redesign above are ultimately about the schema carrying more Relay/graph-theory-flavored convention than the underlying (flat, ES-document-shaped) data needs.

_Design-first. Coordinate with Arranger core module extraction. Will require a migration path for existing consumers._

### API version exposure and schema versioning strategy

_Priority: medium. Prerequisite for hits/edges/nodes redesign; increasingly important for MCP and federated setups._

Two related but distinct problems:

**Arranger version exposure:** The server's health/introspection endpoint should report which version of Arranger it is running. The catalog (ES index) does not know about Arranger versions and should not; this belongs at the server layer. Useful for MCP servers querying multiple Arranger nodes that may run different versions, for federated setups where capability negotiation depends on version, and for operators debugging mismatches. The introspection endpoint already exists; Arranger version should be a first-class field on it.

Prefer exposing this as discrete **capability flags** (e.g. `capabilities: { wildcardOperator: true, catalogueScopedRouting: true }`) alongside, or instead of, a raw semver string. A version string pushes every consumer to hardcode its own `if (serverVersion >= '3.1.0')` threshold for each feature it cares about, scattered per component; a capability flag states the fact directly and needs no version-range knowledge in consumer code, the same reasoning browsers moved from user-agent sniffing to feature detection. See [`DataContext` consuming this in `modules/components`](#capability-aware-consumer-components-via-datacontext) for the concrete first consumer.

**Schema versioning:** The hits/edges/nodes redesign is a breaking API change. GraphQL has no built-in versioning mechanism. Options: run both schema versions simultaneously on separate endpoints, use field-level deprecation with a grace period, or cut a major version and provide a migration guide. The right choice depends on how many external consumers exist and how tightly they are coupled. This must be decided before the redesign work starts.

_Schema versioning decision gates the hits/edges/nodes redesign._

### Capability-aware consumer components via `DataContext`

_Priority: medium. Depends on the "Arranger version exposure" work above landing as capability flags, not just a version string. Motivated by a real, confirmed break, not a hypothetical._

`DataContext`/`DataProvider` should expose what the connected server actually supports, so consumer components can branch their own behaviour on real capabilities instead of assuming the newest wire format the client library happens to know about. Concrete motivating case: [tech-debt: `QuickSearch` sends `op: 'wildcard'` unconditionally, breaking against any server older than the 3.1 cycle](tech-debt.md#quicksearch-sends-op-wildcard-unconditionally-breaking-against-any-server-older-than-the-31-cycle). `QuickSearch` has no way today to know its server predates `wildcard` op support, so it can't fall back to `filter`, it just breaks. A capability-aware `DataContext` fixes this class of problem generally, not just this one operator.

**Real design tension to resolve, not just plumbing:** `DataProvider` deliberately skips calling the introspection endpoint at all when `documentType` is passed explicitly (the common case, avoiding an extra request before real queries can start; see the "`documentType` on `DataProvider` is now optional" changelog entry). Capability detection needs that same endpoint's response. Two options, not obviously compatible with each other:

1. **Eager:** always fetch capabilities on `DataProvider` mount. Simple, but reintroduces the extra request every existing single-catalogue consumer currently avoids, for information most consumers won't need most of the time.
2. **Lazy:** fetch capabilities once, on first request from a consumer that actually needs a capability check (e.g. `QuickSearch` asking "does this server support `wildcard`?"), cache the result on context so later consumers and re-renders don't refetch. No cost for consumers that never ask, but means the first capability-gated interaction pays a request round-trip its own render can't wait on synchronously, needs a defined "unknown yet" state and a sane fallback while it resolves (almost certainly: assume the most conservative/oldest behaviour until proven otherwise, matching how an absent capabilities field, or a 404 from introspection entirely on a pre-3.1 server, should already be read as "no capabilities, assume legacy").

**Absent-capabilities case matters as much as the present case:** a server old enough to lack the introspection endpoint entirely (pre-3.1) won't have this field at all, a 404 or a response missing `capabilities` is itself a valid, expected signal, not an error state, and should resolve to "assume the oldest/most conservative behaviour for every flag," not to `undefined`-and-crash.

_Design-first: decide eager-vs-lazy and the loading/fallback state before touching `QuickSearch` or any other consumer. `QuickSearch`'s `wildcard`/`filter` fallback is the natural first real consumer once the plumbing exists._

### Typed client SDK via GraphQL Codegen (research)

_Priority: low. Research-first; a developer-experience improvement for consumers, not a change to Arranger's own runtime behaviour._

Consumers that build on Arranger (portal frontends, and internally `modules/charts`) currently write GraphQL queries by hand and separately hand-write the TypeScript types describing the expected response shape. Nothing connects the two: if Arranger's schema changes (a field renamed, a type changed), a consumer's hand-written types don't know about it, and the mismatch shows up as a silent runtime bug rather than a build failure.

**Proposal:** adopt [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) (maintained by The Guild, a natural fit alongside `@graphql-tools`, already used in this repo) to generate TypeScript types, and optionally typed query functions, directly from Arranger's schema plus a consumer's query files. A schema change that breaks an existing query becomes a build-time type error for that consumer instead of a runtime surprise.

**How this differs from the mapping-drift detector earlier in this document:** both are instances of the same general problem (two representations of the same information silently drifting apart), but they check different pairs of things for different audiences. This item keeps a consumer's code in sync with whatever schema Arranger currently outputs. The mapping-drift detector keeps Arranger's own configuration in sync with the raw data underneath it. Neither substitutes for the other: perfectly synced configuration and index data doesn't help a frontend developer whose types are stale, and perfectly typed consumer code doesn't tell an operator that a field silently vanished from their own facets.

**Open questions:** would Arranger publish a canonical `.graphql` schema file per release for consumers to generate against, or does this only work well once [API version exposure and schema versioning strategy](#api-version-exposure-and-schema-versioning-strategy) gives schemas a stable versioning story? Multicatalogue deployments complicate this further, since each catalogue's schema differs by index mapping; codegen would need to target one catalogue's schema at a time, not "Arranger's schema" as a singular thing.

### MCP integration readiness

_Priority: mixed per sub-item. One of six shipped (`build_sqon`, 2026-08-10); five open._

Six improvements making Arranger a well-behaved upstream for an MCP server layer. Open: schema cache invalidation signal (ETag/schema hash, `high`), SQON documentation in schema descriptions, field descriptions in the generated schema, making invisible query defaults SDL-visible (research), and the accumulated `/docs` gap for the MCP surface.

Full detail, including `build_sqon`'s as-built scope and the deferred TOON evaluation: [atlas: MCP integration readiness](docs/atlas/roadmap/mcp-integration-readiness.md).

### GraphQL large integer type

_Priority: low. Only urgent if precision bugs are reported._

GraphQL's built-in `Int` is 32-bit signed. `Float` is 64-bit but loses precision for large integers outside the safe integer range. Arranger currently uses `Float` as a workaround for large integer values (IDs, large counts), which is technically lossy and semantically wrong.

Options: (1) a custom scalar (`Long` or `BigInt`, well-supported via the `graphql-scalars` library); (2) represent as `String` where precision matters more than arithmetic; (3) accept `Float` where values are always within the safe integer range. The right answer depends on what values actually flow through in practice; a survey of real catalog data types is needed before deciding.

_Low urgency unless precision bugs appear. Research-first._

---

### Query result caching (research)

_Priority: medium-high; higher priority than the other query-economics item below. Verified absent from the codebase today (no caching layer anywhere in `graphql-router`), and the cost impact on public-facing deployments is direct and immediate rather than theoretical. Research-first: evaluate existing plugins before building anything bespoke._

High-traffic public portals re-run the same default facet aggregation queries constantly, since most users land on the same default view before narrowing their search. A short-TTL cache keyed on the resolved ES/OS query DSL (not the raw GraphQL query string: the same GraphQL query with different SQON filters produces different results) plus a catalogue/index state signal would cut ES/OS load significantly for a large share of real traffic, with bounded staleness risk.

**Evaluate first:** [`graphql-yoga`](https://the-guild.dev/graphql/yoga-server) (already the leading candidate to replace Apollo; see [GraphQL server migration](#graphql-server-migration-away-from-apollo)) ships an official [`@graphql-yoga/plugin-response-cache`](https://the-guild.dev/graphql/yoga-server/docs/features/response-caching) plugin: TTL-based response caching with configurable cache keys and session-aware invalidation, maintained by the same team as the server itself. If the Apollo-to-Yoga migration lands first, this plugin should be the default answer to evaluate before considering a bespoke cache layer; it may substantially shorten this research item.

**Invalidation:** ES/OS index updates (via an operator's indexing pipeline, e.g. Maestro reindexing) need to invalidate stale cache entries. Two options: (a) tie cache keys to the schema/index-state hash already planned for MCP cache invalidation (see [API version exposure and schema versioning strategy](#api-version-exposure-and-schema-versioning-strategy)), so a reindex naturally busts the cache; or (b) accept bounded staleness via a short TTL (30 to 60 seconds, for example) and skip invalidation complexity entirely. Option (b) is simpler and may be sufficient in practice; option (a) is more correct. The right choice depends on how often real deployments reindex during active-use hours.

**Deployment shape matters:** the cache-layer choice (in-memory LRU versus a shared store such as Redis) depends on whether Arranger is expected to run as multiple replicas behind a load balancer. Multi-replica deployments need a shared cache for hits to be useful across instances; a single-replica deployment can use in-memory LRU. This should be a deployment-time configuration choice, not hardcoded to one approach.

### Persisted queries and point-in-time export pagination (research)

_Priority: low but worth tracking. Two independent research items; neither implemented._

Automatic Persisted Queries as a payload-size and DoS-hardening layer, and Point-in-Time contexts for export pagination, where `search_after` alone can skip or duplicate records if the index changes mid-export.

[Detail: prior art, version constraints, sequencing against the Apollo migration](docs/atlas/roadmap/query-economics.md#persisted-queries-and-point-in-time-export-pagination-research)

### Observability: metrics, tracing, and usage analytics (research)

_Priority: low but important. Research-first; complements the existing structured-logging convention rather than replacing it. Confirmed absent: no OpenTelemetry, Prometheus, or `prom-client` references anywhere in the codebase today._

Logging, metrics, and tracing are three distinct observability disciplines. Structured logging is already an established convention here; the other two are not addressed at all. Two related but separable threads:

#### Metrics and tracing

A Prometheus `/metrics` endpoint and distributed tracing spans across the request path. Confirmed absent: no OpenTelemetry or `prom-client` anywhere today.

[Detail: prior art and why this is cheaper after core extraction](docs/atlas/roadmap/observability.md#metrics-and-tracing)

#### Facet and field usage analytics

Distinct from operational metrics above: this is about capturing which fields, operators, and facets are actually exercised in aggregate (counts only, no user identity or query content retained) to drive product decisions: which fields deserve `displayValues` next (see [`displayValues` for all aggregation types](#displayvalues-for-all-aggregation-types)), which facets should default higher in a catalogue's UI, and which configured fields are effectively dead weight. This is explicitly not the same concern as [Facet field groups: user-defined sort order](#facet-field-groups-user-defined-sort-order), which is a per-user manual preference; this is usage-informed defaults for everyone using a given catalogue.

_Design question: does this live in Arranger itself (aggregated counters exposed via an admin-gated endpoint), or is it purely a log-mining exercise against the structured query logs that the metrics/tracing thread above would produce? The latter avoids adding stateful counters to Arranger and may be sufficient; building counters in-app is only clearly worth it if live facet reordering based on real-time usage is ever wanted._

### Structured request logging as a prerequisite for ABAC

_Priority: medium. Sequence before the auth/ABAC work above, not after._

The [Observability](#observability-metrics-tracing-and-usage-analytics-research) item above covers metrics and tracing; neither addresses a narrower, more immediate gap: **there is currently no structured per-request log at all** for a query request. Confirmed absent: nothing in the query resolvers (`resolveHits.js`, `resolveAggregations.ts`) or `apps/search-server` emits a structured event per request today. No log line anywhere in the request path includes user identity, request ID, catalogue name, SQON size, or hit count, which is the minimum context needed for anomaly detection and post-incident reconstruction.

Scope: one structured log event per query request with fields `{ catalogId, queryType, sqonSize, hitsReturned, durationMs }`, extendable to include `userId` once auth lands (the field can be established as absent/`null` now and populated later without a schema change). Unlike the full Observability item, this does not need OpenTelemetry or a `/metrics` endpoint: structured JSON to stdout is sufficient.

This is a genuine prerequisite, not just adjacent work: access denial events (see [Auth and field/record-level access control](#auth-and-fieldrecord-level-access-control)) need somewhere to land once ABAC ships, and that logging shape should exist before enforcement does, not be retrofitted after.

---

## Features

### Fuzzy (edit-distance) SQON operator

_Priority: medium. Distinct from the `wildcard` operator already implemented._

A `fuzzy` op doing Levenshtein matching via ES/OS `multi_match` with `fuzziness: "AUTO"`, same `fieldNames` shape as `wildcard`. Note `docs/concepts.md` already advertises this operator, so the published contract is fixed rather than free (see tech-debt).

[Detail: implementation notes, schema shape, and the AND-versus-OR design question](docs/atlas/roadmap/sqon-operators.md#fuzzy-edit-distance-sqon-operator)

### GA4GH Beacon v2 module

_Priority: low. Design-first; no implementation until arranger-core extraction is further along._

A new `modules/beacon-router` package implementing the GA4GH Beacon v2 REST API as an optional Express router, mounted alongside `graphql-router` so operators opt in. The hard problem is the filtering term registry: Beacon queries use ontology CURIEs with no universal mapping to Arranger fields, so each deployment needs a configurable term registry before filter queries can work at all. Phased: discovery endpoints and count/boolean granularity first, record-level granularity gated on Usher.

Full detail, including the v1 prior-art spike, entry-type mapping, and relationships to core extraction and Usher: [atlas: GA4GH Beacon v2](docs/atlas/roadmap/ga4gh-beacon-v2.md).

### Domain-specific search capabilities (research)

_Priority: low but important. Research-first; no implementation until each sub-question below is scoped. Three related but independent tracks grouped together because they share a theme (moving beyond exact-match faceted filtering), not a timeline._

#### Genomic interval and overlap operator

No current operator expresses "does this record's region overlap chr1:1000-2000", a foundational query for variant and gene data, and a named prerequisite of Beacon's `g_variants` entry type.

[Detail: prior art, and whether this needs a new SQON shape or an indexing requirement](docs/atlas/roadmap/sqon-operators.md#genomic-interval-and-overlap-operator)

#### Relevance-ranked search mode

Arranger's query model today is exact-filter and aggregation-first; there is no first-class "search box" mode with ranked results. `resolveHits.js` already threads `track_scores` through to the ES/OS query, so `_score` is reachable if a caller explicitly requests `sort: [{ fieldName: '_score' }]`, but there is no per-catalogue configuration for field boosting, and no `multi_match`-style query builder for weighted matching across several fields with relevance ranking, as distinct from what `wildcard` gives today (exact substring matching, unweighted).

Prior art: [`multi_match`](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html) with per-field `^boost` weights (for example `title^3,description`) is the standard building block. [`function_score`](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html) would allow boosts that depend on field values (for example, favouring more recent records), if that is ever wanted.

Configuration surface: field boost weights would naturally live in `extended.json`, where per-field configuration already exists, as an additive property rather than a new configuration file.

This is lower-risk than it looks: the response-side plumbing (`track_scores`, generic `sort`) already exists, so the actual gap is entirely in query construction and configuration surface.

#### Hybrid keyword and vector (semantic) search

Longer horizon, flagged as a bigger bet. Semantic search over free-text fields, matching on meaning rather than term overlap. Confirmed absent: no vector or k-NN fields used anywhere today.

[Detail: OpenSearch k-NN prior art, ES version floor, and the unresolved embeddings question](docs/atlas/roadmap/sqon-operators.md#hybrid-keyword-and-vector-semantic-search)

### Sets: full feature implementation

_Priority: active. Backend exists but the feature is incomplete._

Exactly one operation exists end to end: `saveSet`. `listSets`, `deleteSet`, and `updateSet` are entirely absent, there is no UI beyond the MatchBox save affordance, and nothing reads the `userId` the sets index already stores. The ABAC model needs deciding before the backend is finished, since it shapes the data model.

[Detail: confirmed backend inventory, the four separable tracks, virtual cohorts](docs/atlas/roadmap/sets-feature.md)

### Admin UI replacement

_Priority: low. Deprecated app, replacement needed eventually._

`modules/admin-ui` and `integration-tests/admin` are inactive remnants of an old app that managed Arranger configs by storing and mutating objects in a separate Elasticsearch index. That approach is considered a design mistake and the app is no longer in use.

The replacement should generate configs in the current JSON format rather than persisting mutable state in ES. Scope and design are TBD; this work should be coordinated with the config separation effort (see "Arranger config separation") since the config format and validation layer will define what the admin UI is actually managing.

_Do not extend or fix the existing admin-ui. Start fresh when the time comes._

### Admin and user access model

_Priority: medium. Blocked on a design decision, though possibly a narrower one than it looks._

`enableAdmin`'s intent was never defined and it should not be extended until the access model is. Its only reachable effect today is one conditional field resolver, and the code's own FIXME suggests fixing an `aggregation`/`numericAggregation` resolution bug might let the flag be deleted outright.

[Detail: the three in-code signals and the narrowing correction](docs/atlas/roadmap/auth-and-access-control.md#admin-and-user-access-model)

### Quicksearch integration into facets

_Priority: medium. Quality-of-life improvement for high-cardinality fields._

The Quicksearch component currently stands alone. It should be integrable as a Facet variant, particularly useful for fields with many distinct values or ID-type fields where the bucket list becomes unmanageable. The term aggregation (TermAggs) is the natural first integration point: a text input above or within the bucket list lets users filter before selecting.

Design question: a quicksearch-within-TermAggs should filter the displayed buckets without modifying the main SQON until the user makes a selection. Consider whether this replaces or augments the existing TermAggs component, and whether TermAggs should absorb Quicksearch entirely.

_Good TDD candidate once the interaction design is settled._

### SQON editor component

_Priority: low. Developer tooling and power-user feature._

A UI component for reading and editing a raw SQON directly. Useful for developers building on Arranger, for debugging, and as an admin/power-user tool.

Scope is TBD: read-only display is straightforward; editable adds significant complexity (partial states, validation, error feedback). Start with read-only and treat editability as a separate phase.

### Date range aggregation improvements

_Priority: medium. Frequently requested for time-series data._

Date range aggs currently work with fixed absolute date values. Users should be able to specify relative ranges ("last 30 days", "X days from today") with a unit selector in the UI.

Design question: relative dates in a saved SQON must resolve at query time, not save time. Storing "30 days ago" is meaningfully different from storing the resolved timestamp. This affects SQON serialization and how virtual cohorts (see Sets) interact with date-relative queries.

_Needs interaction and data model design before implementation._

### `displayValues` for all aggregation types

_Priority: medium. Extends existing behaviour uniformly._

The `displayValues` feature maps raw field values to human-readable labels (e.g. `"M"` → `"Male"`). Confirmed source of truth: `extendFields` (`modules/graphql-router/src/mapping/extendMapping.ts:184-196`) populates a flat `displayValues: Record<string, string>` per field, typed as `ExtendedMappingInterface.displayValues` (`modules/components/src/DataContext/types.ts:41`) and exposed via GraphQL: the same shape is already fetched and available to every consumer regardless of agg type.

**Confirmed current state, by component:**

- **BooleanAggs: implemented.** `BooleanAggs/index.tsx:24` destructures `displayValues` (as `extendedDisplayKeys`), merges it with defaults at lines 49-57, and it drives the toggle labels at lines 131 and 152.
- **TermAggs: not implemented.** `TermAggs/TermAggs.jsx:96` has only `// TODO: displayValues may fit here`; `decorateBuckets` maps `bucket.key_as_string ?? bucket.key` through a generic string formatter (`translateSQONValue`), not a config-driven label lookup. No `displayValues` prop is accepted anywhere in the file.
- **RangeAgg / DatesAgg: not implemented.** No trace of `displayValues` in either component.
- **Table column rendering: not implemented, and this is a real gap today, not speculative.** `Table/helpers/cells.tsx`'s `getDisplayValue` (lines 27-36) only special-cases `date` columns; the boolean cell type stringifies `true`/`false` directly. `displayValues` is fetched via GraphQL but never read in `cells.tsx`, `columns.tsx`, or `Row/Cell.tsx`.

TermAggs remains the correct next target given their frequency of use, then RangeAgg/DatesAgg, then the table column display, in that order.

_Relatively self-contained. Good TDD candidate. Start with TermAggs._

### Facet field groups: user-defined sort order

_Priority: low. UX improvement; persistence is the hard problem._

Allow users to reorder facet field groups interactively (drag-and-drop is the natural UX). The challenge is persistence: without an auth or session model, user preferences can only be stored client-side (localStorage), which is per-browser and not shareable or reproducible.

_The drag-and-drop UI can be prototyped independently. Persistence design should wait until the Admin/auth model and Sets ABAC model are defined; those may provide a natural home for user preferences._

### Custom columns and custom facet groups via config

_Priority: medium. Frequently needed by Arranger integrators._

Arranger configs should allow operators to define additional table columns and additional facet groups beyond what is auto-generated from the index mapping. This gives integrators control over default display without modifying core Arranger behaviour.

_Blocked on config separation; where these definitions live (server vs. UI config layer) is a design question that must be settled first. See "Arranger config separation" in the Architecture section._

### `DownloadButton` `onExport` callback

_Priority: high. Small, single-package, client-side only._

Add a public `onExport` callback prop to `DownloadButton`'s theme, firing for any export path, whether the exporter is the built-in `'saveTSV'` or a fully custom function, with the same `ExporterFunctionProps` payload (`sqon`, `selectedRows`, `url`, `files`) the exporter itself receives. Named to match `Aggregations`'s existing `onValueChange` callback precedent, rather than something export-specific like `onDownload`.

This is deliberately a thin, generic hook, not an export-format change: it lets a consumer add a side effect (analytics tracking is the confirmed real case) around any export without needing to know or reimplement how the export itself works. `saveTSV`'s internals stay unexported and free to change later; `onExport` firing alongside whichever exporter ran is what keeps that transparent to the consumer.

Originates from [tech-debt: `DownloadButton`'s exporter customization reads as `'saveTSV'`-only, but accepts any function](tech-debt.md#downloadbuttons-exporter-customization-reads-as-savetsv-only-but-accepts-any-function), fix option (2); confirmed against a real integration need (iMicroSeq portal UI, Google Analytics download-tracking), not speculative.

### `saveCSV` export format

_Priority: medium. Cross-package: `modules/components` (client wrapper) and `modules/graphql-router` (new server-side format support). Not a same-day pairing with `onExport` despite the shared origin: this is real new work, not a separator swap._

Add a `saveCSV` export option alongside the existing `saveTSV`. Initially assumed to be "a wrapper around the existing logic, passing a different separator"; verified against the actual server-side code and that assumption doesn't hold. `modules/graphql-router/src/download/index.js`'s `dataToStream` and `src/utils/dataToExportFormat.js` only implement `fileType: 'json'`/`'tsv'`; any other value throws `'Unsupported file type specified for export.'`. The tab separator is hardcoded in `rowToTSV` (`.join('\t')`) and in `columnsToHeader`'s `'tsv'` case, not parameterized.

Real scope:

- **Server (`modules/graphql-router`):** a new `'csv'` case in `dataToStream`'s format switch and in `columnsToHeader`; a new `rowToCSV` (not a parameterized `rowToTSV`, since CSV needs actual value-escaping that TSV never required: commas, double quotes, and embedded newlines in field values all need quoting/escaping per [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180), whereas TSV's separator rarely collides with real data).
- **Client (`modules/components`):** a `saveCSV` counterpart to `saveTSV` in `Table/DownloadButton/helpers.ts`, reusing the same column-customizer resolution logic (`useCustomisers`) `saveTSV` already has, requesting the new `'csv'` format from the server.

Originates from [tech-debt: `DownloadButton`'s exporter customization reads as `'saveTSV'`-only, but accepts any function](tech-debt.md#downloadbuttons-exporter-customization-reads-as-savetsv-only-but-accepts-any-function); raised alongside `onExport` but scoped and prioritized separately since it touches the server and needs genuinely new CSV-escaping logic, not just a client-side change.

## Components

The `modules/components` package carries significant legacy weight and has accumulated several years of organic growth. The items below can be approached incrementally; none require a big-bang rewrite; but the Emotion replacement decision should be made before extending the theming infrastructure.

### Components module modernization

_Priority: medium-high for the `recompose` removal specifically; medium for the rest._

`recompose` is abandoned and calls `React.createFactory()`, removed in React 19, while the package's peer range already advertises React 19 support. Confirmed scope: `recompose` in 4 files, `component-component` in 10 (7 of them in `AdvancedSqonBuilder/`), 16 class components.

[Detail: the confirmed compatibility risk and per-pattern file inventory](docs/atlas/roadmap/components-modernization.md#components-module-modernization)

### Extend the theming engine to all components

_Priority: medium. Consistency issue affecting integrators._

Most aggregation components already participate in the theme system; the gaps are `Aggregations.jsx`, `AggsQuery.jsx`, `aggComponentsMap.jsx`, `AggsPanel.jsx`, `SelectAllButton.jsx`, and `Tooltip/`. Tooltip is the next concrete target and does not depend on the Emotion decision.

[Detail: the charts theming split and the Tooltip approach](docs/atlas/roadmap/components-modernization.md#extend-the-theming-engine-to-all-components)

### Replace Emotion with a less constrained styling solution

_Priority: medium-high. Decided 2026-08-04: ShadCN on Base UI with `cva`._

Module-wide migration, not a localized swap: 46 files import from `@emotion/*`. A proof-of-concept on one or two components should precede the full migration.

[Detail: the decision rationale and why Base UI over Radix](docs/atlas/roadmap/components-modernization.md#replace-emotion-with-a-less-constrained-styling-solution)

### Accessibility (a11y) audit and remediation

_Priority: medium. Natural companion to Components modernization and Emotion replacement._

No systematic accessibility audit has been done on `modules/components`. The components are used in clinical and research data portals where accessibility compliance may be required by policy or law.

Adopting Base UI as part of the Emotion replacement (see decision above) would provide a strong a11y baseline at low cost; Base UI, like Radix before it, handles ARIA roles, keyboard navigation, and focus management natively. Doing a11y remediation and the Emotion replacement together is substantially cheaper than a separate pass.

Scope: audit against WCAG 2.1 AA, prioritize high-impact gaps (keyboard navigation, screen reader support, colour contrast), remediate as part of the Components modernization effort.

_Coordinate with the Emotion replacement (decided: ShadCN/Base UI + `cva`); doing both together is much cheaper than doing a11y as a separate pass._

### Storybook (or similar) for `modules/components`/`modules/charts`, carrying their own integration tests

_Priority: medium. Confirmed real gap: nothing tests server schema generation through to UI rendering._

Not greenfield. `modules/charts` already has a complete, empty Storybook 9 harness (stories needed, not infrastructure); `modules/components` has a dead 2018 Storybook 3 install that is separately the source of 42 of the repo's 45 `npm audit` criticals. Split the work accordingly.

[Detail: the gap this let ship, and the per-package state](docs/atlas/roadmap/components-modernization.md#storybook-or-similar-for-modulescomponentsmodulescharts-carrying-their-own-integration-tests)

## Security

### GraphQL query complexity analysis

_Priority: low. Basic protections already in place._

Alias and depth limits are implemented and configurable. Per-resolver cost weighting against a total budget is the remaining hardening step.

[Detail: the confirmed interaction with genuinely nested clinical schemas, and the now-closed batching vector](docs/atlas/roadmap/query-economics.md#graphql-query-complexity-analysis)

### Request rate limiting

_Priority: medium. Missing protection layer for public-facing deployments._

Arranger has GraphQL query complexity limits but no overall request rate limiting. A client can send unlimited valid queries, which is an availability risk (OWASP A07).

Rate limiting is often applied at the infrastructure layer (reverse proxy, ingress controller) rather than in the application; whether Arranger needs its own application-level layer depends on how deployments are structured. Some will have it handled upstream, others won't.

Candidate approach if implemented in-app: configurable Express middleware (e.g. `express-rate-limit`) applied per-IP or per-API-key, configurable via server-level config.

_Design question: should Arranger implement this itself, or document that deployers are expected to handle it upstream? Needs a decision before implementation._

### Dependency vulnerability scanning in CI

_Priority: medium. Design challenge around balancing security and release velocity._

`npm audit` can catch known vulnerabilities in dependencies (OWASP A03: Software Supply Chain Failures). The challenge is policy: `--audit-level=high` will block releases when a vulnerability exists in a transitive dependency with no available fix, which happens and is outside the team's direct control.

Options: run as a non-blocking report (visibility without blocking), block on critical only, or maintain an allowlist for accepted/unfixable issues. The right policy depends on risk tolerance and release cadence.

_Recommended starting point: add `npm audit --audit-level=critical` as a non-blocking CI report to understand the current baseline before committing to a failure policy._

### Aggregation privacy masking (small count suppression)

_Priority: high for deployments with sensitive data. Needs design before implementation._

When aggregate counts are small enough that individual records may be re-identifiable, the API should suppress or mask those values rather than return them. This is a known requirement in clinical, genomic, and other sensitive-data contexts (and relevant to OWASP A01: Broken Access Control, A06: Insecure Design).

The masking logic belongs in the core query layer, not the UI; the server must not return suppressible values regardless of how it is queried. Key design questions:

- What threshold triggers suppression, and is it configurable per-catalog?
- What is returned in place of a suppressed value: null, a range indicator (`< 5`), a flag?
- Does suppression cascade? (If a subcategory is suppressed, does its parent total become suppressible too?)

_Needs design before implementation. Treat as a blocking design question for any Arranger deployment handling sensitive or regulated data._

---

## Deployment

### Decouple startup health check from application credential

_Priority: medium. Standalone once the approach is agreed._

`ping-elasticsearch.sh` calls `/_cluster/health` with the application credential, forcing `cluster:monitor/health` onto a role that never uses it. Move the readiness gate into a Kubernetes init container with its own elevated credential, leaving the app with `cluster:monitor/main` only.

[Detail: the full fix, the rejected simpler alternative, and the Vault/Helm work required](docs/atlas/roadmap/health-check-credential.md)

### Helm chart update

_Priority: medium. Maintenance burden for production deployments._

The existing Arranger Helm chart should be reviewed and updated. The direction is to evaluate reusing or extending the organization's "stateless service" chart rather than maintaining a fully custom one; this reduces maintenance burden and keeps Arranger's deployment config aligned with how other services are deployed.

_Needs coordination with infrastructure/DevOps. Scope and chart inventory to be confirmed before starting._

---

## Ideation (not committed)

Ideas and possible directions surfaced during design discussions, not yet committed to being built. Distinct from the rest of this document: the "Status: items are open/planned unless marked `[done]` or `[in progress]`" convention at the top does not apply here. No obligation to ever implement; revisit only if a concrete need arises.

### Prometheus metrics endpoint for catalogue availability

_Surfaced 2026-07-24 during the multicatalogue partial-availability design._

A per-catalogue availability gauge, so "which catalogues are down, why, and for how long" is alertable without overloading the boolean health probes.

[Detail: relationship to the general observability item](docs/atlas/roadmap/observability.md#prometheus-metrics-endpoint-for-catalogue-availability)

## CI/CD & Release Process

### Check published type resolution with `arethetypeswrong`

_Priority: medium. Publishing correctness, independent of feature work._

`@arethetypeswrong/cli` (0.18.5 at time of writing) inspects a published tarball and reports whether its type declarations actually resolve under each module system and resolution mode a consumer might use: CJS require, ESM import, `node16`, `bundler`. It catches the class of defect where a package typechecks in its own repo and fails for a consumer, which is invisible to any check that runs inside the monorepo.

This repo is unusually exposed to that class. It publishes five packages mid JS-to-TS migration, each with its own `exports` map, and `tsconfig.release.json` sets `noCheck`, so the build emits declarations without verifying them. A separate tech-debt entry already records a phantom export shipping undetected because no test asserts that every public name resolves; that is the same failure from the runtime side, and this tool is the type side of it.

Done when: `attw` runs against each publishable package's packed tarball in the release pipeline, and a resolution failure blocks publish rather than being discovered by a consumer.

_Pairs with the existing `release:check` script (`scripts/verify-pack.mjs`), which already packs and inspects contents; this extends that step rather than adding a new one._

### Extend property-based testing beyond `modules/sqon`

_Priority: medium. Test-coverage work, doable incrementally._

`fast-check` is a devDependency of `modules/types` and `modules/sqon`, and `modules/sqon` now has a property test asserting `reduceSqon`'s idempotency and semantic preservation. That test exists because hand-picked cases repeatedly missed real defects that generated input found immediately.

Three other places have the same shape, each named because a real defect was found there rather than because property testing is generally good:

- **`normalizeFilters`** (`modules/graphql-router/src/middleware/buildQuery/`): idempotency, the identical property. Flattening a same-op child into its parent was applied to `not`, which is not associative, so a doubly-negated filter compiled to the complement of what was asked for. A generated-input idempotency check is exactly what finds that.
- **`graphqlNameFns` and `graphqlNameRegistry`**: two properties. Every sanitized name is a legal GraphQL name, and no two distinct raw field paths share a sanitized name without being reported as a collision. The second is an open tech-debt entry: the flat aggregation namespace has collisions the per-parent check cannot see.
- **`compileFilter`** (`modules/graphql-router/src/mapping/utils/`): the property that no composed filter is ever returned without a leaf clause. This is the access-control guard and it has no test file at all.

Done when: each of the four functions above has a property test in its own package, and `fast-check` is a devDependency wherever one lives.

_The `compileFilter` case is the one to do first: it is the only one on a security path, and it currently has zero coverage rather than partial coverage._

### Consolidate code sorting onto one tool

_Priority: low. Tooling cleanup, independent of everything else._

Three mechanisms currently order code and none of them covers object literals, which is where ordering mistakes actually happen. `import/order` (`eslint.config.js:83`) sorts and groups imports. `prettier-plugin-organize-imports` sorts them again at format time, and separately removes unused ones via the TypeScript language service. Object keys, `type` and `interface` members, and JSX props are ordered by attention alone, which is the one case a linter would catch and a convention cannot: the property-ordering rule already describes the failure exhaustively, including the conditional-spread variant, and was still missed.

`eslint-plugin-perfectionist` (5.10.1 at time of writing) covers all of it except unused-import removal, which it cannot do because that needs type information. So it replaces `import/order` and not `organize-imports`, leaving one sorter plus one pruner instead of two sorters plus one pruner.

Done when: one tool owns ordering; `sort-objects`, `sort-interfaces`, `sort-object-types` and `sort-jsx-props` are enforced at error level; `import/order` is removed.

_Two things to establish before committing to it, neither answerable by reading. Whether perfectionist's `sort-imports` can be configured to emit what `organize-imports` emits, since one runs at lint time and the other at format time and a disagreement makes them ping-pong; the existing `#` pathGroup makes this non-trivial. And whether `sort-objects` covers destructured parameters, which the convention's own text flags as uncertain._

_Blocked on the `dist/` lint scope fix, tracked in `.dev/tech-debt.md`: with build output linted, a new rule lands in a backlog of roughly 17,600 problems that is about 89% `dist/`, so the control would exist and be invisible._


### Context

Pipeline: `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`. Helper steps are in `step*` files in the same folder, loaded automatically via CasC (not imported explicitly in the Jenkinsfile).

**Branching model:**

- `main` builds, tests, publishes Docker image with `edge` tag (to become `next`), deploys to `overture-dev`
- `release` / `release-test` additionally: tags git, publishes Docker with version + `latest` tag, publishes NPM packages
- `release-charts` temporary branch for publishing the charts module separately (marked TEMP; to be cleaned up)

**Versioning intent:** `0.0.0-dev` in `main` is deliberate; versioning is a `release`-branch concern, not a developer concern. NPM publish only runs on `release`, where version bumps happen. This keeps version management out of the day-to-day development workflow.

**Current state (not yet improved):** builds every module on every run (`npm run modules:build`, individual `npm run test -w` per module), no Turbo change detection, ES 7.17.27 in the pod spec (to change with OpenSearch-first migration).

The goal is a phased improvement: first get Turbo doing change detection in CI (the highest-value, lowest-risk change), then automate versioning, then modernize the package manager.

---

## Phase 1: Immediate (1-3 days, single PR, no Jenkins changes)

Fix correctness issues in the repo that block Turbo from working reliably.

### 1.2 Add `lint` and `typecheck` scripts to all publishable modules

Would enable Turbo to cache lint and typecheck results per-package. Not needed for Phase 2 (lint/typecheck are not being added to CI yet; see Phase 4.3).

### 1.3 Add `turbo:lint` and `turbo:typecheck` root scripts

Depends on 1.2 and on turbo.json gaining `lint`/`typecheck` task definitions.

---

## Phase 2: Short-term (1-3 weeks, Jenkins pipeline changes)

Switch the pipeline to use Turbo with `--filter=[HEAD^1]` for change detection.

**Key insight:** `--filter=[HEAD^1]` uses `git diff` to find packages with source file changes relative to the previous commit, then walks the dependency graph downstream. This is purely git-based; no remote cache required.

### 2.1 Replace `npm run modules:build` with `turbo run build`

**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`

```groovy
// Stage 1: Before
sh "npm run modules:build"

// Stage 1: After
def isRelease = (env.BRANCH_NAME ==~ /release.*/)
def turboFilter = isRelease ? "" : "--filter=[HEAD^1]"
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run build ${turboFilter}"
```

Release branches drop the filter to always build everything. Feature/main branches only build affected packages.

### 2.2 Replace individual `npm run test -w X` calls with `turbo run test`

```groovy
// Stage 2: Before (individual -w flags per module)
sh "npm run test -w modules/sqon"
sh "npm run test -w modules/types"
// ... etc

// Stage 2: After
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run test ${turboFilter} --filter=!integration-tests/server"
```

`--filter=!integration-tests/server` keeps the Elasticsearch-dependent tests out of Turbo's managed run. Those continue to run unconditionally in a separate stage.

### 2.3 Scoped NPM publish (no change needed yet)

The existing version-check in Stage 6 (`local_version != remote_version`) already handles this correctly until Changesets is adopted.

### 2.4 Publish "next" tag from main: Docker and NPM

**Docker:** Change the image tag for `main` builds from `edge` to `next` (one-line change in the `Publish images` stage, line ~270 of the pipeline).

**NPM:** No packages are currently published from `main` (only from `release`). Publishing `next`-tagged npm packages from `main` requires:

1. **Version number strategy:** `0.0.0-dev` is a fixed placeholder and cannot be published repeatedly. A dynamic pre-release version must be generated at publish time; e.g. `0.0.0-next.{commit-sha}`. The `main` branch would never push a real version; the pre-release suffix makes each publish unique.

2. **Change detection prerequisite:** Only packages with actual source changes should be published; publishing all packages on every merge is wasteful and polluting. Turbo's `--filter=[HEAD^1]` (Phase 2.1/2.2) provides this. The NPM `next` publish stage depends on Turbo being wired into the pipeline first.

3. **New publish stage:** A new Jenkins stage, scoped to `main`, that dynamically constructs the pre-release version and publishes with `--tag next`.

_Depends on Phases 2.1 and 2.2 being complete. The Docker change can land independently; the NPM change follows._

**Follow-on, once this ships: Stage-side auto-consumption.** With a continuously-published `next` npm tag, Stage (or any downstream consumer) could auto-bump to it (Renovate, or a scheduled Jenkins job) and redeploy automatically, making `modules/components`/`modules/charts` changes testable live in-cluster shortly after merging to Arranger's `main`, instead of the current manual `npm link` workflow. Route this at a separate canary/preview deployment, not Stage's shared dev deployment that other people rely on for unrelated testing, so an in-progress component change never surprises someone else using dev for something else. Not yet scoped or actioned; parking here until the `next` tag publish itself ships.

---

## Phase 3: Mid-term (1-3 months, moderate changes)

### 3.1 Adopt Changesets for versioning and changelog automation

**Sequencing: depends on §3.3 (pnpm) landing first, despite the numbering.** Changesets' cascade-bump detection needs `workspace:` or real-semver references, not `file:`.

Replaces manual version bumping and Jenkins git tagging; packages version independently. PR authors declare severity via `npx changeset`; the release branch runs `changeset publish`.

Full detail, including the worked config, the API-surface-diff enhancement, and what Changesets does versus what pnpm's publish step does: [atlas: Changesets adoption](docs/atlas/roadmap/changesets-adoption.md).

### 3.2 Testcontainers for integration test infrastructure

_Replaces hardcoded sidecar containers with test-owned, programmatically managed containers._

Currently, `integration-tests/server` depends on a pre-running Elasticsearch instance (provided by the CI pod spec sidecar, or a locally running ES for development). This creates two problems:

- Testing against multiple engines (ES + OpenSearch) or versions requires multiple pod containers or multiple CI runs
- Developers need a running ES/OS instance to run integration tests locally

[Testcontainers](https://node.testcontainers.org/) (npm: `@testcontainers/node`) lets tests spin up Docker containers programmatically. Each test suite declares what it needs; containers start before the suite and stop after. The CI pod already has Docker-in-Docker, so this works without infrastructure changes.

Benefits for Arranger:

- Run the integration suite against both ES 7, ES 8, and OpenSearch in a single CI run: a proper engine compatibility matrix
- Developers can run integration tests locally without a pre-running instance (`docker` is sufficient)
- Engine versions are specified in test code, not in a pod spec; easier to maintain and update

Tradeoff: container startup adds latency per suite. Manage by sharing one container instance across all tests in a run (not one per test file).

_The CI pod already has dind; testcontainers would work today. Evaluate as part of the OpenSearch-first migration work._

### 3.3 Migrate from npm to pnpm

_Priority: next up as of 2026-08-14, ahead of the rest of Phase 3, unless something more urgent
displaces it. See [atlas: pnpm migration scoping findings](docs/atlas/pnpm-migration.md) for the
full reasoning behind everything below; this entry stays the actionable checklist._

Catches phantom dependencies at install time, faster CI installs, removes `dangerouslyDisablePackageManagerCheck`.

**Corepack Docker gotcha (learned from Lyric):** When adopting pnpm with corepack in a multi-stage Dockerfile, use `corepack prepare pnpm@x.y.z --activate`, not `corepack use pnpm@x.y.z`. `corepack use` only updates package.json; the binary is fetched lazily at runtime. If the pod has no egress to registry.npmjs.org (common in locked-down clusters), startup fails with a corepack download error. `corepack prepare --activate` downloads and caches the binary during image build, so the pod needs no network access to start. This also matters beyond egress: a read-only container filesystem at runtime can't fetch anything lazily either, so `corepack prepare --activate` at build time isn't just a workaround for locked-down clusters, it's required whenever the runtime filesystem is read-only.

1. Install pnpm on Jenkins nodes (coordinate with infra)
2. Create `pnpm-workspace.yaml` (replacing npm workspaces declaration; confirmed pnpm has no package.json-collocated option for this, unlike wireit)
3. Run `pnpm import` to generate `pnpm-lock.yaml`
4. Add `"packageManager": "pnpm@10.x.x"` to root `package.json`
5. Migrate `overrides` to `pnpm.overrides` (note: `>` separator syntax)
6. Remove `dangerouslyDisablePackageManagerCheck` from `turbo.json`
7. Update Jenkins: `pnpm install --frozen-lockfile`
8. Allowlist native dependency install scripts (new, see below) so CI doesn't hang on an interactive prompt

**Phantom-dependency audit: done and fixed (2026-08-15).** `npx depcheck` run against every workspace found genuine undeclared-but-imported dependencies in `apps/search-server` (`lodash-es`), `integration-tests/import` (`@jest/globals`), `integration-tests/mcp-server` and `integration-tests/server` (`@overture-stack/arranger-types`, `dotenv`, both), `modules/components` (`query-string`, `@emotion/is-prop-valid`, `prop-types` in source; `eslint-plugin-import`, `globals`, `babel-polyfill` in tooling config), `modules/graphql-router` (`@graphql-tools/mock`, `graphql-tools`), and `modules/sqon`/`modules/types` (`ts-patch`, per the prototype above). All now declared correctly, verified clean on a second `depcheck` pass plus the full test suite. One real version-compatibility catch along the way, `query-string`'s current major is ESM-only and broke `components`' CJS build outright; pinned to the last CJS-compatible major instead. Full detail in [atlas: pnpm migration scoping findings](docs/atlas/pnpm-migration.md).

**New risk, not previously documented:** pnpm v10+ blocks a dependency's install scripts (postinstall, etc.) by default, and fails the install outright rather than skipping silently. `tsup` (builds `sqon`/`types`) depends on `esbuild`, which has a native postinstall step; a first `pnpm install` will very likely fail until this is allowlisted via `pnpm approve-builds` or a committed `onlyBuiltDependencies` list.

**Resolved via prototype (2026-08-15): `ts-patch` is fully compatible with pnpm.** The only real risk was already known: `sqon` and `types` invoke `ts-patch install -s` without declaring `ts-patch` as their own dependency (unlike `components`/`graphql-router`, which do this correctly), a real phantom dependency `depcheck` can't see since it's a shell-invoked binary, not a JS import. Confirmed by prototype that this breaks outright under pnpm and is fixed by adding the missing declaration. Add `ts-patch` to `sqon`'s and `types`' own `devDependencies` as part of this migration's checklist. `wireit`'s cross-package dependency graph under pnpm workspaces remains unverified by prototype; developer confidence accepted as sufficient for now. Full detail in the atlas doc.

**Cleanup when this lands:** Replace all `file:` dep specs with `workspace:*` across every `package.json` in the repo (publishable modules, `apps/`, and `integration-tests/`). pnpm replaces `workspace:*` with real version ranges at publish time automatically. Also remove `scripts/fix-workspace-deps.mjs` and its `node scripts/fix-workspace-deps.mjs` / `git checkout` lines from the Jenkins publish loop here (moved from §3.1, which had this attributed to Changesets incorrectly). `scripts/verify-pack.mjs` already checks for `workspace:` refs as well as `file:` refs, so it remains valid as-is; pairing it with an actual `pnpm pack`/`pnpm publish --dry-run` check per package (verifying the real packed output, not just the source `package.json`) is worth adding at the same time.

**Blocker found 2026-08-17, not in the checklist above:** `modules/charts` declares `@overture-stack/arranger-components` in `peerDependencies` only, with no `dependencies` or `devDependencies` counterpart, while seven of its source files import it. It resolves today purely via npm's workspace-root symlink; under pnpm's strict isolation it will not be linked and the build fails on first install. Add the missing `devDependency` before starting. More importantly, this is the **second** confirmed `depcheck` blind spot (it counts a `peerDependencies` entry as declared) after `ts-patch` (a shell-invoked binary), which means the phantom-dependency audit's "clean" verdict for `apps/mcp-server` and `modules/sqon` is weaker evidence than it reads as. Re-audit by a method that does not share depcheck's assumptions before the migration, rather than trusting the earlier pass. See [tech-debt: `arranger-components` is declared peer-only](tech-debt.md#arranger-components-is-declared-peer-only-which-will-break-the-first-pnpm-install-the-phantom-dependency-audit-could-not-see-it).

**Also resolve before migrating:** the root `overrides.esbuild: "0.17.19"` pin is currently inert (the committed lockfile's nested resolutions predate it), but a from-scratch resolution honours it and collapses `tsx`, `vite`, and `storybook` onto a 2023 esbuild. `pnpm import` regenerates from the lockfile and would carry the current four-esbuild shape across, so decide whether to scope the override to the `tsup` edge that needs it or drop it, before the migration rather than after. Separately, the `overrides` blocks in `modules/components/package.json` and `modules/graphql-router/package.json` are silently ignored by npm (overrides are root-only) and would be equally ignored by `pnpm.overrides`; delete them rather than translating them across.

**nx consideration:** nx is an alternative monorepo build system to Turborepo, not a complement. Turbo + pnpm is the current plan. If Turbo proves insufficient (e.g. more complex task orchestration, code generation, or module federation needs arise), nx is worth evaluating. For now, proceed with Turbo.

**Resolved, corrects §3.1's own "Cleanup when this lands" note:** `changeset version` does not rewrite `file:` (or `workspace:`) deps to real version ranges; `workspace:^` means "always use the local version," there's no version number in that string for Changesets to touch. That substitution happens exclusively via pnpm's own publish step, described above. Changesets' `updateInternalDependencies` does something adjacent but different: deciding whether a *dependent* package needs its own cascading version bump when a sibling changes, not rewriting how the dependency is referenced. See [atlas: pnpm migration scoping findings](docs/atlas/pnpm-migration.md) for the full resolution. **Consequence: this section needs to land before §3.1, not after, despite the numbering** (§3.1's cascade-bump detection needs a `workspace:` or real-semver reference to act on, not `file:`).

---

## Phase 4: Long-term (3+ months)

### 4.1 Enable Turborepo remote cache (self-hosted)

When build times warrant it, self-host using MinIO or Cloudflare R2:

- `turbo.json`: `"remoteCache": { "enabled": true }`
- Jenkins env vars: `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`

### 4.2 Enforce module boundary rules via ESLint

Prevent UI packages (`components`, `charts`) from importing server modules (`graphql-router`). Add to `eslint.config.js`:

```javascript
{
  files: ["modules/components/**", "modules/charts/**"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [{ name: "@overture-stack/arranger-graphql-router", message: "UI packages must not import server modules" }]
    }]
  }
}
```

### 4.3 Typecheck as a required CI gate

Currently some modules have `noCheck: true` workarounds. Once resolved, add to Jenkins pipeline:

```groovy
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run typecheck ${turboFilter}"
```

### 4.4 Renovate for automated dependency updates

Replace ad-hoc Dependabot with Renovate Bot; groups minor/patch updates into weekly PRs across all workspace packages simultaneously.

---

## Dependency Graph Reference

Redrawn 2026-08-17 from the actual manifests; the previous version was wrong in four ways that all understated what a `sqon` change rebuilds.

```
sqon
 ├─ types
 │   ├─ graphql-router
 │   │   ├─ search-server
 │   │   ├─ integration-tests/server        ← ES-dependent
 │   │   └─ integration-tests/mcp-server    ← ES-dependent
 │   ├─ components         (declares BOTH types and sqon)
 │   └─ charts             (devDependency, and bundles it into dist/)
 ├─ components
 ├─ graphql-router
 └─ mcp-server

components
 ├─ charts                 ← peerDependencies ONLY, see §3.3 blocker
 └─ integration-tests/import
```

When `sqon` changes, `--filter=[HEAD^1]` includes `types`, `graphql-router`, `search-server`, `integration-tests/server`, `integration-tests/mcp-server`, `apps/mcp-server`, and `components` (and therefore `charts` and `integration-tests/import`) via the `^build` chain. In practice that is nearly the whole repo, which is worth knowing before assuming change detection will narrow much on a `sqon` edit.

What the previous diagram got wrong: (1) `components` was marked "independent of server chain" but declares both `arranger-types` and `sqon`, so it is downstream of both; (2) `apps/mcp-server` was absent entirely despite declaring `sqon`; (3) `integration-tests/mcp-server` was absent despite depending on `graphql-router` and `types`; (4) the `components → charts` edge is not backed by a resolvable declaration at all, only a `peerDependencies` entry, which is the §3.3 blocker noted above.

Two consequences for Phase 2: the `integration-tests/server` node was annotated `cache: false` here but `turbo.json` does not actually set it, and §2.2's `--filter=!integration-tests/server` excludes only one of the two ES-dependent suites (and uses a directory path where the package name is `integration-tests-search-server`). Both suites also default `SERVER_PORT` to 5678, which is safe under today's sequential `npm run test --ws` and will race the moment Turbo parallelizes them.
