# Arranger Roadmap

This document covers two categories of planned work: **product and architecture** (features, structural evolution, technical modernization) and **CI/CD and release process** (pipeline, versioning, tooling). Both matter — neither is more "real" than the other.

**Status:** items are open/planned unless marked `[done]` or `[in progress]`.

---

## Architecture

### OpenSearch-first migration

_Priority: high — next concrete technical effort after documentation._

Arranger currently treats Elasticsearch as the de-facto standard and OpenSearch as an afterthought. This should be reversed: OpenSearch is the actively maintained open-source fork and the direction the community is moving, and it should be the primary supported engine with ES as a supported variant.

The scope is wider than just swapping a client library. It includes the `SearchClient` abstraction in `graphql-router`, the Makefile, `docker-compose` setup for local development, and the integration test suite (which currently runs against ES). The goal is that a developer cloning the repo and running `make dev` gets OpenSearch by default.

The `SearchClient` abstraction already exists as the right boundary — the migration should align the types and default configuration to OpenSearch while preserving compatibility for ES users.

**What's already done:** The integration test suite (`integration-tests/server`) already supports both engines via a `SEARCH_ENGINE` env var (defaults to `'elasticsearch'`). `buildSearchClient` accepts a `client` type parameter mapped to `SupportedClientTypes`. The architecture is ready; the missing pieces are the OpenSearch client dependency and a running OpenSearch instance in CI.

**CI pod spec:** The current pod runs `elasticsearch:7.17.27` for integration tests. The intent is to keep ES in the pod (to verify ES compatibility) and add an OpenSearch container alongside it, then run the integration suite twice — once per engine. See "Testcontainers for integration tests" below for an alternative approach that avoids hardcoding engine versions in the pod spec.

### GraphQL server migration (away from Apollo)

_Priority: medium — blocked by, or done in parallel with, the core module extraction._

Apollo Server 3 is end-of-life. Upgrading to Apollo Server 4 is not the right move — the goal is to move _away_ from Apollo, not deeper into it. Apollo is opinionated about its hosting environment (it assumes Express-style middleware, has its own context and plugin APIs) in ways that conflict with the longer-term direction of decoupling Arranger from any specific framework.

The leading replacement candidate is **graphql-yoga** (maintained by The Guild, who also maintain `@graphql-tools` — already used in this repo). It runs on any JS runtime, integrates with Express without requiring it, supports the same schema-first approach the codebase uses, and is actively maintained. This is a research-confirmed candidate, not a final decision.

Done when: Apollo is removed from `graphql-router`, the type errors currently masked in `graphqlRoutes.ts` are resolved, and the `buildContext` API has a clear, well-typed contract.

### Arranger core module extraction

_Priority: medium-high — the central piece of the architecture evolution._

The search and aggregation logic currently living inside `graphql-router` is coupled to GraphQL and Express in ways that aren't inherent to the logic itself. The goal is to extract this into a separate, framework-agnostic module — working name `arranger-core`, though the final name is TBD — that exposes pure query-building and result-mapping functions with no transport dependencies.

`graphql-router` would then become a thin adapter: it takes the GraphQL query, calls core, and shapes the response. This mirrors how `search-server` is already separated from `graphql-router` — that separation was a deliberate early step toward this goal.

The practical benefit: integrators who want Arranger's search capabilities in a REST API, gRPC service, or any other context could use `arranger-core` directly without pulling in GraphQL dependencies.

_Design work needed: define the interface between core and transport. The config system (currently server-level vs catalog-level) will also need to be revisited once the transport coupling is removed — see [tech-debt: config constants reorganization](tech-debt.md#config-constants-need-reorganization--blocked-on-architecture-work)._

### Auth and field/record-level access control

_Priority: medium — blocked on both the Overture ABAC design and the Arranger core module boundary._

Arranger currently has no awareness of who is making a query or what they are allowed to see. The closest existing functionality is **server-side filters** — a callback where the caller can inject additional SQON filters per request. This is a useful IoC escape hatch but it is not auth: Arranger doesn't understand why the filters are there, has no semantic access model, and provides no standard way to plumb identity or claims into it.

The Overture platform is building a cross-app ABAC system using Keycloak. The design question for Arranger is: **how much auth responsibility does Arranger itself need to own, versus delegating to a layer above it?**

Key design questions (not yet answered):

- **Field-level access:** Can this user see this field at all? (e.g. suppress clinical fields for non-approved users.) This may need to be expressed inside the query builder — filtering out fields before they are fetched — rather than as a post-processing step.
- **Record-level access:** Can this user see this record? This maps more naturally to a filter injected into every query, which server-side filters already approximate.
- **Where does the auth layer live?** Options: (1) in Arranger core itself (tight coupling, but consistent); (2) as a separate `arranger-auth` module in this monorepo that mediates between Keycloak and Arranger (a cleaner separation); (3) as infrastructure-level enforcement upstream of Arranger (proxy, gateway) — Arranger trusts that the request is already authorized.
- **Cross-Overture consistency:** Other Overture apps are not GraphQL, don't use ES/OS, and don't use SQONs. The ABAC solution should be consistent across apps — which suggests Arranger should consume a shared auth abstraction rather than invent its own.
- **Server-side filters redesign:** If ABAC lands, server-side filters may need to evolve from a raw SQON callback into something that understands user identity and translates claims into query constraints.
- **Multi-catalog filter composition:** In multi-catalog mode, there should be support for a global server-side filter that composes with catalog-local filters, with deterministic precedence and merge behaviour so access-control rules are consistent across single- and multi-catalog deployments. Needed for Controlled Access implementations in multicatalog setups.

This design intersects with Sets (ABAC for saved queries), the Admin/user access model, and the Arranger core module extraction (the core/transport boundary affects where auth checks are applied).

_Needs design at the Overture platform level before Arranger-specific work can be scoped. Do not extend server-side filters in the interim without awareness of this direction._

### Transport layer abstraction

_Priority: long-term — depends on core module extraction._

Once `arranger-core` exists, `graphql-router` becomes one of potentially several transport adapters. Other transports (a REST adapter, for instance) should be buildable by anyone without forking or duplicating core logic. The interface contract between core and transport is the design work that needs to happen first.

This is a directional goal, not an actionable item yet.

### `sqon-builder` absorption into `modules/sqon`

_Priority: medium — separate repo, should be absorbed into this monorepo._

The direction is **not** a lateral merge: `modules/sqon` is the host. It grows to subsume `sqon-builder`'s capabilities — primarily the builder/chainable API and the SQON manipulation utilities — so that `modules/sqon` becomes the single package for everything SQON: validation, operator metadata, JSON Schema, and programmatic construction. `sqon-builder` is then deprecated and its consumers redirected.

#### What sqon-builder brings that is worth keeping

**Builder/chainable API** — `SQONBuilder.in('x', ['a']).and(SQONBuilder.gt('y', 5))`. Genuinely useful for programmatic SQON construction in UI code and the MCP server. Used in `graphql-router`'s `convertToSqon` path and presumably in `modules/components`.

**`reduceSQON`** — a non-trivial deduplication and simplification algorithm. Merges duplicate filters under the same combination (e.g. two `gt` on `and` collapses to the greater value), unwraps single-item wrappers, removes empty combinations. No equivalent in `modules/sqon`.

**Filter manipulation methods** — `removeFilter`, `removeExactFilter`, `setFilter`. These are stateful builder operations that the UI depends on for interactive SQON editing (adding/removing facet selections).

**`checkMatchingFilter` / `checkMatchingArrays`** — semantic filter comparison, order-independent. Worth keeping as a utility export.

**`from()` static parser** — parses a raw object into a builder. The MCP-layer `convertToSqon` already uses this.

**`emptySQON()`** — trivial but a useful starting point for builder chains.

#### What needs to be fixed or extended during absorption

**Operator coverage gap** — the single largest issue. `sqon-builder` only implements `in`, `gt`, `lt`. It cannot build `not-in`, `some-not-in`, `all`, `gte`, `lte`, `between`, or `filter` queries. The absorbed builder must cover all operators `modules/sqon` already defines. Any SQON a consumer can _validate_ they must also be able to _build_.

**`reduceSQON` operator coverage gap** — the reduction logic only handles specific cases for `GT`, `LT`, and `IN`. When the builder gains the full operator set, the reduction rules for `gte`, `lte`, `between`, and `not-in` need to be defined and implemented. Some cases are clear (two `gte` on `and` → keep the greater); others need deliberate design (what does it mean to reduce two `between` ranges on `and`?).

**Own Zod schema** — `sqon-builder` defines its own `ArrayFilterValue`, `ScalarFilterValue`, `SQON`, etc. which diverge from and are a strict subset of `modules/sqon`'s schema. The absorbed builder must use `modules/sqon`'s types exclusively. The builder-internal types go away.

**`@ts-expect-error` in graphql-router** — `network/utils/sqon.ts` has `@ts-expect-error sqon-builder types need update` when calling `SQONBuilder.from()`. This is a type misalignment symptom that disappears once the builder's types are grounded in `modules/sqon`'s schema.

**Boolean value support** — add `zod.boolean()` to `SqonScalarValueSchema` in the unified schema (see [tech-debt: boolean values](tech-debt.md#sqon-value-schema-does-not-accept-boolean-values)). The builder inherits the fix automatically.

#### What to leave behind

**The `& SQON` type pattern — a known design mistake.** `sqon-builder` types the builder as `SQONBuilder & SQON`, meaning the builder object _is simultaneously the data_. This is wrong. `SqonNode` (the canonical SQON type, defined in `modules/sqon`) represents a JSON-serializable query structure — it has no methods and should never have them. The builder is a separate construction tool that produces `SqonNode` values; it is not itself a `SqonNode`.

The correct design is a clean wrapper: `SqonBuilder` holds a `SqonNode` internally, exposes builder methods, and has explicit extraction: `toValue(): SqonNode` and `toString(): string`. The data type and the construction API are two distinct things.

The consequences of the `& SQON` anti-pattern:

- `cloneDeepValues` exists only to strip builder methods before serialization — it is a workaround for the blur, not a useful utility in its own right.
- The `StripFunctions<T>` generic is a type-level admission that the type is wrong.
- Consumers can accidentally pass a builder where a plain `SqonNode` is expected.
- The `@ts-expect-error` in `graphql-router`'s `sqon.ts` is a direct downstream symptom.

This must be explicit in the implementation, the TypeScript types, and the JSDoc. `SqonNode` is the data type. `SqonBuilder` is a factory. They must not be conflated.

**`createFilter` in its current form** — only handles `in`/`gt`/`lt` and is tightly coupled to the old type constants. Rewrite against the full operator set with the new types.

**`cloneDeepValues`** — only exists because of the `& SQON` pattern. Goes away with the wrapper redesign.

**sqon-builder's constants** (`FilterKeys`, `ArrayFilterKeys`, `ScalarFilterKeys`, `CombinationKeys`) — `modules/sqon` already has `sqonFieldOperatorProperties`, `sqonCombinationProperties`, and `sqonAliasProperties`. One set of constants.

#### Migration path

1. Add the builder API and manipulation utilities to `modules/sqon`, implemented against the full operator set and the existing Zod schema. Export as `SqonBuilder` (or similar) alongside the existing exports.
2. Add a `from()` static method to `SqonBuilder` that calls `SqonSchema.parse()` internally — replacing the sqon-builder's `SQON.parse()` call.
3. Update `graphql-router`'s `convertToSqon` to import from `@overture-stack/arranger-sqon` instead of `@overture-stack/sqon-builder`. The `@ts-expect-error` goes away.
4. Update `modules/components` and any other consumer of `sqon-builder`.
5. Deprecate `sqon-builder`. Publish a final version pointing consumers at `@overture-stack/arranger-sqon`.
6. Remove `sqon-builder` as a dependency.

_Note: `sqon-builder` git history can be preserved via `git subtree add` or `git filter-repo` if desired, but this is optional — the source is small enough to port directly. The `sqon-builder` monorepo integration work described previously is superseded by this._

### Consolidate field-type-to-operator rules into `modules/sqon`

_Priority: medium — cleanup work, doable independently._

The logic for mapping ES field types to valid SQON operators currently exists in two separate places: `getValidFieldOperators()` in `modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts`, and `getSqonFieldOperatorDetails()` in `modules/sqon`. These encode the same domain knowledge independently and will drift as operators or types are added.

The goal is to make `modules/sqon` the single source of truth. `getSqonFieldOperatorDetails()` should be extended to carry the field-type classification detail currently encoded only in `buildCatalogueIntrospection.ts` (the ENUM_LIKE_TYPES / RANGE_TYPES distinction, boolean handling, etc.). `buildCatalogueIntrospection.ts` then becomes a thin projection over that data rather than a parallel implementation.

Done when: `buildCatalogueIntrospection.ts` no longer contains its own operator-applicability logic; `modules/sqon` exports all the rules needed for any consumer to determine valid operators for a given ES field type.

_Aligns with `sqon-builder` monorepo integration — if/when `sqon-builder` merges into `modules/sqon`, this work should be done first or alongside to avoid tripling the implementations._

### Network aggregation as a separate concern

_Priority: medium — currently coupled to graphql-router, should be its own bounded layer._

The federated "network search" feature — querying multiple Arranger nodes and aggregating their results — is currently wired directly into `graphql-router`. It should eventually be extracted as its own module or clearly bounded layer, independent of both the core and the transport. This would allow the network layer to evolve without touching the local search path, and would make it possible to federate over non-GraphQL transports in the future.

_Needs design work before implementation. Not yet scoped._

### search-server route organization

_Priority: low — structural improvement, no behaviour change._

`apps/search-server/src/server.ts` currently wires all route concerns directly in the main server setup. As the server grows (health checks, introspection, arranger routes), route registration should be organized into a `routes/` directory:

- `routes/arranger.ts` — catalogue router setup (currently `arrangerRoutes.ts`)
- `routes/health.ts` — health/ping endpoint
- `routes/introspection.ts` — introspection endpoints (already partially separated)
- `server.ts` composes these: each route module exports a factory and `server.ts` mounts them

The refactor is purely structural — no behaviour changes, no new features. `arrangerRoutes.ts` at the `src/` root was the natural first step; `routes/` becomes the convention once there are multiple route files.

_Standalone: yes. Small PR, no upstream dependencies._

### Multicatalog catalogue lifecycle and metadata

_Priority: medium — needed for production multicatalog deployments._

Catalogs can fail to load or be intentionally disabled. There is currently no explicit model for what "unavailable" means. Needed work:

- **Availability model:** Introduce explicit catalog statuses: `available`, `failed`, `disabled`. `failed` = should load but cannot; `disabled` = intentionally operator-disabled. Unavailable catalogs should remain visible in server metadata so clients can distinguish "catalog exists but unavailable" from "catalog does not exist".
- **Catalog metadata endpoint:** `GET /:catalogId` should return `200` whenever the server itself is healthy, with a catalog metadata object: status, document type, machine-readable error metadata, human-readable reason text. With `enableDebug`, optionally include richer diagnostics for unavailable catalogs.
- **Unavailable catalogue behaviour:** Failed catalog GraphQL endpoints return `404`; the catalog metadata endpoint remains accessible even when GraphQL is down for that catalog.

_Design-first. Coordinate with the API version exposure entry — catalog metadata and server introspection are related surfaces._

### Arranger config separation

_Priority: medium-high — blocked on core module extraction._

The current config model conflates several distinct concerns: server-level config (port, CORS), transport-level config (GraphQL-specific options), Arranger core config (search engine, index settings), and UI config (component behaviour, display options). These are currently mixed because the modules are currently coupled — separating them before the architecture supports it would be premature.

Once the core module boundary is defined, configs should be reorganized into at least three layers — server, transport, and core — and UI config should be clearly separated so front-end consumers don't need to reason about server-level settings. Each config property should be documented (purpose, type, default, which layer it belongs to) and validated at the boundary using Zod or a similar schema library.

_Blocked on core module extraction. See also [tech-debt: config constants reorganization](tech-debt.md#config-constants-need-reorganization--blocked-on-architecture-work). Custom columns and custom facet groups (in the Features section) depend on this work._

### Config validation with structured errors and tests

_Priority: medium — usability and reliability improvement, doable without waiting for config separation._

Config loading in both the server (`apps/search-server`) and within Arranger's internal handling currently has no runtime validation. Invalid or missing values fail silently or produce confusing runtime errors far from the source of the problem. The fix is schema validation at the config boundary — reject bad configs early with a clear, actionable message identifying exactly what is wrong and where.

Scope:

- **Server config** (`apps/search-server`): env vars and server-level settings — validate that required values are present and correctly typed on startup. Fail fast with a human-readable error rather than surfacing a cryptic crash later.
- **Catalog config** (the per-catalog JSON loaded by Arranger): validate against the expected schema before the catalog is registered. Where a value is missing but has a safe default, warn rather than error.
- **Validation library:** Zod is the leading candidate — it produces typed output and legible error messages. The config separation roadmap entry already assumes Zod; this item just brings validation forward to the current config shape.
- **Tests:** validation logic should be tested directly — both the happy path and representative error cases (missing required field, wrong type, unknown key).

_This work is independent of the config separation effort and is not blocked on it — it validates configs in their current shape. When config separation lands, the validation schemas will need updating to reflect the new layer boundaries, but that is an incremental change, not a rewrite._

### Redesign the document model (hits / edges / nodes)

_Priority: medium — design-first, breaking API change._

The current response model — `hits { total, edges { node { ... } } }` — is a GraphQL convention borrowed from the Relay cursor-based pagination spec. It is verbose, unfamiliar to users not steeped in Relay, and maps awkwardly to the flat document structure of most Arranger catalogs.

The goal is a more declarative, JSON-friendly model that maps closer to actual data shapes while remaining model-agnostic. This is a breaking change to the GraphQL API surface and affects any consumer of Arranger. It should be designed in coordination with the core module extraction, since the core module's output contract defines what "a result" looks like before it reaches any transport layer.

_Design-first. Coordinate with Arranger core module extraction. Will require a migration path for existing consumers._

### API version exposure and schema versioning strategy

_Priority: medium — prerequisite for hits/edges/nodes redesign; increasingly important for MCP and federated setups._

Two related but distinct problems:

**Arranger version exposure:** The server's health/introspection endpoint should report which version of Arranger it is running. The catalog (ES index) does not know about Arranger versions and should not — this belongs at the server layer. Useful for MCP servers querying multiple Arranger nodes that may run different versions, for federated setups where capability negotiation depends on version, and for operators debugging mismatches. The introspection endpoint already exists; Arranger version should be a first-class field on it.

**Schema versioning:** The hits/edges/nodes redesign is a breaking API change. GraphQL has no built-in versioning mechanism. Options: run both schema versions simultaneously on separate endpoints, use field-level deprecation with a grace period, or cut a major version and provide a migration guide. The right choice depends on how many external consumers exist and how tightly they are coupled. This must be decided before the redesign work starts.

_Schema versioning decision gates the hits/edges/nodes redesign._

### MCP integration readiness

Three targeted improvements to make Arranger a well-behaved upstream for an MCP server layer. These arose from reviewing the Arize text-to-graphql-mcp reference implementation against Arranger's current schema surface.

#### Schema cache invalidation signal (ETag / schema hash)

_Priority: high._

An MCP server wrapping Arranger will cache the introspected schema to avoid re-fetching on every query. Arranger's schema is generated from ES/OS index mappings, which can change when indices are updated or reindexed. Without a cache invalidation signal, an MCP server has no way to know when its cached schema is stale -- it will generate queries against a schema that no longer matches the live index, producing errors that are hard to diagnose.

Arranger should expose a schema hash or ETag on introspection responses (a response header is sufficient -- no new endpoint needed) so MCP consumers can cheaply detect schema changes and re-fetch only when necessary. Extends naturally from the "API version exposure" work above, which already adds a version field to the introspection endpoint.

_Small Arranger change, high operational value for any MCP implementation. Coordinate with whoever is building the MCP server._

#### SQON documentation in schema descriptions

_Priority: medium._

Arranger's filter arguments accept SQON, but the generated schema types them as opaque input objects with no documentation of the expected structure. An LLM generating queries against the schema has no way to know what a valid SQON looks like from schema introspection alone -- every MCP implementation has to embed SQON-specific system prompts as a workaround.

Adding a description to the filter argument input types explaining the SQON structure (content/combination operators, value types, nesting rules) would let the LLM infer the filter format directly from the schema. This reduces coupling between the MCP prompt layer and Arranger internals, and benefits GraphQL Playground users at the same time.

_See `docs/concepts.md` for the canonical SQON definition to base descriptions on._

#### Field descriptions in the generated schema

_Priority: medium._

The GraphQL schema Arranger generates from ES/OS index mappings currently carries no field descriptions -- only raw field names. An LLM building queries against this schema must select fields by name alone, with no semantic context. The Arize reference implementation strips all schema descriptions to save tokens precisely because they tend to be noisy; Arranger's schema instead has none at all.

Arranger should surface field descriptions from ES mapping metadata (the `meta` object on a field mapping, which can carry arbitrary key-value pairs including a `description`) as GraphQL field descriptions. Where no metadata description exists, the field name is still the fallback. This gives LLM consumers (and Playground users) meaningful context at the point where it costs nothing to add it.

_Requires a mapping-to-schema pass change. Operators who want richer descriptions can add `meta.description` to their index mappings without any Arranger code change._

---

### GraphQL large integer type

_Priority: low — only urgent if precision bugs are reported._

GraphQL's built-in `Int` is 32-bit signed. `Float` is 64-bit but loses precision for large integers outside the safe integer range. Arranger currently uses `Float` as a workaround for large integer values (IDs, large counts), which is technically lossy and semantically wrong.

Options: (1) a custom scalar — `Long` or `BigInt`, well-supported via the `graphql-scalars` library; (2) represent as `String` where precision matters more than arithmetic; (3) accept `Float` where values are always within the safe integer range. The right answer depends on what values actually flow through in practice — a survey of real catalog data types is needed before deciding.

_Low urgency unless precision bugs appear. Research-first._

---

## Features

### Sets — full feature implementation

_Priority: active — backend exists but the feature is incomplete._

Sets are saved groupings of documents from a catalog — think "save this search result for later" or "share this selection with a colleague." The backend infrastructure exists but Sets are not yet a complete user-facing feature. The full scope includes:

- **Backend:** Complete resolver logic, index lifecycle management, full CRUD operations, and proper error handling.
- **UI:** Components for creating, viewing, managing, and sharing sets. Needs to integrate with the existing filter/search UI.
- **Access control:** Sets should support Attribute-Based Access Control (ABAC). A set has an owner; it can be private, shared with specific users, or public. This design needs to be done before the backend is completed, as it affects the data model.
- **Virtual cohorts:** Rather than storing a static list of document IDs, a set can be defined as a saved filter/query that resolves dynamically at query time. This is more powerful and avoids stale sets when the underlying data changes.

This is a substantial multi-sprint effort. Backend and UI work can be parallelized once the ABAC model is defined. The `DISABLE_SETS` feature flag exists precisely because this is a work in progress — it should remain until the feature is complete and stable.

### Admin UI replacement

_Priority: low — deprecated app, replacement needed eventually._

`modules/admin-ui` and `integration-tests/admin` are inactive remnants of an old app that managed Arranger configs by storing and mutating objects in a separate Elasticsearch index. That approach is considered a design mistake and the app is no longer in use.

The replacement should generate configs in the current JSON format rather than persisting mutable state in ES. Scope and design are TBD — this work should be coordinated with the config separation effort (see "Arranger config separation") since the config format and validation layer will define what the admin UI is actually managing.

_Do not extend or fix the existing admin-ui. Start fresh when the time comes._

### Admin and user access model

_Priority: medium — blocked on design decision._

The `enableAdmin` flag is inherited from the original codebase. In its current form, "admin mode" exposes additional API surface (primarily mapping introspection) but its intent was never clearly defined. Before this is extended or built upon, the access model needs to be designed from first principles:

- What actions should require elevated access that a regular user cannot perform?
- Is "admin" the right conceptual boundary, or should this be a more granular role system?
- Should the flag be renamed to better reflect what it actually gates?

Until these questions are answered, the `enableAdmin` flag and its associated code should not be extended. The decision has downstream implications for the Sets ABAC model as well — the two features should be designed together or at least in awareness of each other.

### Quicksearch integration into facets

_Priority: medium — quality-of-life improvement for high-cardinality fields._

The Quicksearch component currently stands alone. It should be integrable as a Facet variant — particularly useful for fields with many distinct values or ID-type fields where the bucket list becomes unmanageable. The term aggregation (TermAggs) is the natural first integration point: a text input above or within the bucket list lets users filter before selecting.

Design question: a quicksearch-within-TermAggs should filter the displayed buckets without modifying the main SQON until the user makes a selection. Consider whether this replaces or augments the existing TermAggs component, and whether TermAggs should absorb Quicksearch entirely.

_Good TDD candidate once the interaction design is settled._

### SQON editor component

_Priority: low — developer tooling and power-user feature._

A UI component for reading and editing a raw SQON directly. Useful for developers building on Arranger, for debugging, and as an admin/power-user tool.

Scope is TBD: read-only display is straightforward; editable adds significant complexity (partial states, validation, error feedback). Start with read-only and treat editability as a separate phase.

### Date range aggregation improvements

_Priority: medium — frequently requested for time-series data._

Date range aggs currently work with fixed absolute date values. Users should be able to specify relative ranges — "last 30 days", "X days from today" — with a unit selector in the UI.

Design question: relative dates in a saved SQON must resolve at query time, not save time. Storing "30 days ago" is meaningfully different from storing the resolved timestamp. This affects SQON serialization and how virtual cohorts (see Sets) interact with date-relative queries.

_Needs interaction and data model design before implementation._

### `displayValues` for all aggregation types

_Priority: medium — extends existing behaviour uniformly._

The `displayValues` feature maps raw field values to human-readable labels (e.g. `"M"` → `"Male"`). It currently works in BooleanAggs but not TermAggs or other agg types. TermAggs should be the next target given their frequency of use, then extend to all agg types and the table column display.

_Relatively self-contained. Good TDD candidate. Start with TermAggs._

### Facet field groups: user-defined sort order

_Priority: low — UX improvement; persistence is the hard problem._

Allow users to reorder facet field groups interactively (drag-and-drop is the natural UX). The challenge is persistence: without an auth or session model, user preferences can only be stored client-side (localStorage), which is per-browser and not shareable or reproducible.

_The drag-and-drop UI can be prototyped independently. Persistence design should wait until the Admin/auth model and Sets ABAC model are defined — those may provide a natural home for user preferences._

### Custom columns and custom facet groups via config

_Priority: medium — frequently needed by Arranger integrators._

Arranger configs should allow operators to define additional table columns and additional facet groups beyond what is auto-generated from the index mapping. This gives integrators control over default display without modifying core Arranger behaviour.

_Blocked on config separation — where these definitions live (server vs. UI config layer) is a design question that must be settled first. See "Arranger config separation" in the Architecture section._

---

## Components

The `modules/components` package carries significant legacy weight and has accumulated several years of organic growth. The items below can be approached incrementally — none require a big-bang rewrite — but the Emotion replacement decision should be made before extending the theming infrastructure.

### Components module modernization

_Priority: medium — ongoing maintenance cost that compounds over time._

The components package still uses patterns that predate React hooks: `recompose` (an HOC composition library), `component-component` (a render-prop state machine), and class-based components throughout. These are no longer idiomatic React and make the codebase harder to read, test, and extend.

Scope:

- Remove `recompose` and `component-component` — replace HOC and render-prop patterns with hooks
- Convert remaining class components to function components
- Simplify the aggregations components, which have accumulated redundant abstractions over time (multiple layers of HOC wrapping that add indirection without adding value)

Can be done incrementally, component by component, without breaking the public API.

### Extend the theming engine to all components

_Priority: medium — consistency issue that affects integrators._

The table component introduced a theming system that lets operators customize appearance through a theme prop. This pattern should be extended to facets, aggregation components, and other UI pieces so operators have a uniform customization surface. Currently some components use the theme engine, others don't.

_Coordinate with the Emotion replacement decision before investing heavily here — the styling mechanism affects how theming is implemented._

### Replace Emotion with a less constrained styling solution

_Priority: medium-high — blocks or complicates several other component improvements._

Emotion is the current CSS-in-JS library. It ties the build to Babel and has known caching issues in some environments. Two alternatives worth evaluating:

- **Radix UI** — headless, unstyled accessible primitives. Provides behaviour (keyboard nav, ARIA, focus management) without imposing styles. Arranger would own all visual styling.
- **ShadCN** — built on Radix with Tailwind CSS. Provides a starting set of styled components as copy-paste source rather than as a runtime dependency. More opinionated but faster to an initial working UI.

These are architecturally different from Emotion — the choice has downstream effects on the component API, the theming model, and how much visual work integrators need to do. A proof-of-concept with one or two components is strongly recommended before committing.

_This decision gates the theming extension work. Make this call before extending the current Emotion-based theme infrastructure._

### Accessibility (a11y) audit and remediation

_Priority: medium — natural companion to Components modernization and Emotion replacement._

No systematic accessibility audit has been done on `modules/components`. The components are used in clinical and research data portals where accessibility compliance may be required by policy or law.

Adopting Radix UI as part of the Emotion replacement would provide a strong a11y baseline at low cost — Radix handles ARIA roles, keyboard navigation, and focus management natively. Doing a11y remediation and the Emotion replacement together is substantially cheaper than a separate pass.

Scope: audit against WCAG 2.1 AA, prioritize high-impact gaps (keyboard navigation, screen reader support, colour contrast), remediate as part of the Components modernization effort.

_Coordinate with Emotion replacement — doing both together is much cheaper than doing a11y as a separate pass._

---

## Security

### GraphQL query complexity analysis

_Priority: low — basic protections are already in place._

Alias count and depth limits are implemented (`maxAliasesRule`, `maxDepthRule` in `graphql-router`, configurable via `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` environment variables). These address the specific DoS vectors that were identified.

A more thorough approach would assign cost weights to individual field resolvers and reject queries that exceed a total complexity budget — so a query with 10 expensive aggregation fields costs more than 10 cheap scalar fields. The `graphql-query-complexity` library handles this well. This is a hardening step worth doing eventually, but not urgent given the current protections.

### Request rate limiting

_Priority: medium — missing protection layer for public-facing deployments._

Arranger has GraphQL query complexity limits but no overall request rate limiting. A client can send unlimited valid queries, which is an availability risk (OWASP A07).

Rate limiting is often applied at the infrastructure layer (reverse proxy, ingress controller) rather than in the application — whether Arranger needs its own application-level layer depends on how deployments are structured. Some will have it handled upstream, others won't.

Candidate approach if implemented in-app: configurable Express middleware (e.g. `express-rate-limit`) applied per-IP or per-API-key, configurable via server-level config.

_Design question: should Arranger implement this itself, or document that deployers are expected to handle it upstream? Needs a decision before implementation._

### Dependency vulnerability scanning in CI

_Priority: medium — design challenge around balancing security and release velocity._

`npm audit` can catch known vulnerabilities in dependencies (OWASP A03: Software Supply Chain Failures). The challenge is policy: `--audit-level=high` will block releases when a vulnerability exists in a transitive dependency with no available fix — which happens and is outside the team's direct control.

Options: run as a non-blocking report (visibility without blocking), block on critical only, or maintain an allowlist for accepted/unfixable issues. The right policy depends on risk tolerance and release cadence.

_Recommended starting point: add `npm audit --audit-level=critical` as a non-blocking CI report to understand the current baseline before committing to a failure policy._

### Aggregation privacy masking (small count suppression)

_Priority: high for deployments with sensitive data — needs design before implementation._

When aggregate counts are small enough that individual records may be re-identifiable, the API should suppress or mask those values rather than return them. This is a known requirement in clinical, genomic, and other sensitive-data contexts (and relevant to OWASP A01: Broken Access Control, A06: Insecure Design).

The masking logic belongs in the core query layer, not the UI — the server must not return suppressible values regardless of how it is queried. Key design questions:

- What threshold triggers suppression, and is it configurable per-catalog?
- What is returned in place of a suppressed value — null, a range indicator (`< 5`), a flag?
- Does suppression cascade? (If a subcategory is suppressed, does its parent total become suppressible too?)

_Needs design before implementation. Treat as a blocking design question for any Arranger deployment handling sensitive or regulated data._

---

## Deployment

### Helm chart update

_Priority: medium — maintenance burden for production deployments._

The existing Arranger Helm chart should be reviewed and updated. The direction is to evaluate reusing or extending the organization's "stateless service" chart rather than maintaining a fully custom one — this reduces maintenance burden and keeps Arranger's deployment config aligned with how other services are deployed.

_Needs coordination with infrastructure/DevOps. Scope and chart inventory to be confirmed before starting._

---

## CI/CD & Release Process

### Context

Pipeline: `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`. Helper steps are in `step*` files in the same folder, loaded automatically via CasC (not imported explicitly in the Jenkinsfile).

**Branching model:**

- `main` → builds, tests, publishes Docker image with `edge` tag (to become `next`), deploys to `overture-dev`
- `release` / `release-test` → additionally: tags git, publishes Docker with version + `latest` tag, publishes NPM packages
- `release-charts` → temporary branch for publishing the charts module separately (marked TEMP — to be cleaned up)

**Versioning intent:** `0.0.0-dev` in `main` is deliberate — versioning is a `release`-branch concern, not a developer concern. NPM publish only runs on `release`, where version bumps happen. This keeps version management out of the day-to-day development workflow.

**Current state (not yet improved):** builds every module on every run (`npm run modules:build`, individual `npm run test -w` per module), no Turbo change detection, ES 7.17.27 in the pod spec (to change with OpenSearch-first migration).

The goal is a phased improvement: first get Turbo doing change detection in CI (the highest-value, lowest-risk change), then automate versioning, then modernize the package manager.

---

## Phase 1 — Immediate (1–3 days, single PR, no Jenkins changes)

Fix correctness issues in the repo that block Turbo from working reliably.

### 1.1 Add `test` script to `charts`

`modules/charts` has `vitest` in devDependencies but no `"test"` script. Decided to skip — the goal for `charts` is build and publish integration, not test coverage at this stage. Turbo will silently skip packages with no matching script, which is acceptable here.

### 1.2 Add `lint` and `typecheck` scripts to all publishable modules

Would enable Turbo to cache lint and typecheck results per-package. Not needed for Phase 2 (lint/typecheck are not being added to CI yet — see Phase 4.3).

### 1.3 Add `turbo:lint` and `turbo:typecheck` root scripts

Depends on 1.2 and on turbo.json gaining `lint`/`typecheck` task definitions.

---

## Phase 2 — Short-term (1–3 weeks, Jenkins pipeline changes)

Switch the pipeline to use Turbo with `--filter=[HEAD^1]` for change detection.

**Key insight:** `--filter=[HEAD^1]` uses `git diff` to find packages with source file changes relative to the previous commit, then walks the dependency graph downstream. This is purely git-based — no remote cache required.

### 2.1 Replace `npm run modules:build` with `turbo run build`

**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`

```groovy
// Stage 1 — Before
sh "npm run modules:build"

// Stage 1 — After
def isRelease = (env.BRANCH_NAME ==~ /release.*/)
def turboFilter = isRelease ? "" : "--filter=[HEAD^1]"
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run build ${turboFilter}"
```

Release branches drop the filter to always build everything. Feature/main branches only build affected packages.

### 2.2 Replace individual `npm run test -w X` calls with `turbo run test`

```groovy
// Stage 2 — Before (individual -w flags per module)
sh "npm run test -w modules/sqon"
sh "npm run test -w modules/types"
// ... etc

// Stage 2 — After
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run test ${turboFilter} --filter=!integration-tests/server"
```

`--filter=!integration-tests/server` keeps the Elasticsearch-dependent tests out of Turbo's managed run. Those continue to run unconditionally in a separate stage.

### 2.3 Scoped NPM publish (no change needed yet)

The existing version-check in Stage 6 (`local_version != remote_version`) already handles this correctly until Changesets is adopted.

### 2.4 Publish "next" tag from main — Docker and NPM

**Docker:** Change the image tag for `main` builds from `edge` to `next` (one-line change in the `Publish images` stage, line ~270 of the pipeline).

**NPM:** No packages are currently published from `main` (only from `release`). Publishing `next`-tagged npm packages from `main` requires:

1. **Version number strategy:** `0.0.0-dev` is a fixed placeholder and cannot be published repeatedly. A dynamic pre-release version must be generated at publish time — e.g. `0.0.0-next.{commit-sha}`. The `main` branch would never push a real version; the pre-release suffix makes each publish unique.

2. **Change detection prerequisite:** Only packages with actual source changes should be published — publishing all packages on every merge is wasteful and polluting. Turbo's `--filter=[HEAD^1]` (Phase 2.1/2.2) provides this. The NPM `next` publish stage depends on Turbo being wired into the pipeline first.

3. **New publish stage:** A new Jenkins stage, scoped to `main`, that dynamically constructs the pre-release version and publishes with `--tag next`.

_Depends on Phases 2.1 and 2.2 being complete. The Docker change can land independently; the NPM change follows._

---

## Phase 3 — Mid-term (1–3 months, moderate changes)

### 3.1 Adopt Changesets for versioning and changelog automation

Replaces manual version bumping + Jenkins git tagging. Packages version **independently**.

```bash
npm install --save-dev @changesets/cli
npx changeset init
```

Configure `.changeset/config.json`:

```json
{
	"changelog": "@changesets/cli/changelog",
	"commit": false,
	"linked": [],
	"access": "public",
	"baseBranch": "main",
	"updateInternalDependencies": "patch",
	"ignore": [
		"@overture-stack/arranger-search-server",
		"@overture-stack/arranger-mcp-server",
		"integration-tests-import",
		"integration-tests-server"
	]
}
```

New workflow: PR authors run `npx changeset` to declare which packages changed and at what semver level. On `release` branch, replace Jenkins Stage 4 + Stage 6 with:

```groovy
sh "npx changeset publish"
```

### 3.2 Testcontainers for integration test infrastructure

_Replaces hardcoded sidecar containers with test-owned, programmatically managed containers._

Currently, `integration-tests/server` depends on a pre-running Elasticsearch instance (provided by the CI pod spec sidecar, or a locally running ES for development). This creates two problems:

- Testing against multiple engines (ES + OpenSearch) or versions requires multiple pod containers or multiple CI runs
- Developers need a running ES/OS instance to run integration tests locally

[Testcontainers](https://node.testcontainers.org/) (npm: `@testcontainers/node`) lets tests spin up Docker containers programmatically. Each test suite declares what it needs; containers start before the suite and stop after. The CI pod already has Docker-in-Docker, so this works without infrastructure changes.

Benefits for Arranger:

- Run the integration suite against both ES 7, ES 8, and OpenSearch in a single CI run — a proper engine compatibility matrix
- Developers can run integration tests locally without a pre-running instance (`docker` is sufficient)
- Engine versions are specified in test code, not in a pod spec — easier to maintain and update

Tradeoff: container startup adds latency per suite. Manage by sharing one container instance across all tests in a run (not one per test file).

_The CI pod already has dind — testcontainers would work today. Evaluate as part of the OpenSearch-first migration work._

### 3.3 Migrate from npm to pnpm

Catches phantom dependencies at install time, faster CI installs, removes `dangerouslyDisablePackageManagerCheck`.

1. Install pnpm on Jenkins nodes (coordinate with infra)
2. Create `pnpm-workspace.yaml` (replacing npm workspaces declaration)
3. Run `pnpm import` to generate `pnpm-lock.yaml`
4. Add `"packageManager": "pnpm@10.x.x"` to root `package.json`
5. Migrate `overrides` to `pnpm.overrides` (note: `>` separator syntax)
6. Remove `dangerouslyDisablePackageManagerCheck` from `turbo.json`
7. Update Jenkins: `pnpm install --frozen-lockfile`

**Risk:** Verify `ts-patch install -s` prepare hooks work under pnpm's stricter hoisting. May need `ts-patch` in root devDependencies.

**nx consideration:** nx is an alternative monorepo build system to Turborepo — not a complement. Turbo + pnpm is the current plan. If Turbo proves insufficient (e.g. more complex task orchestration, code generation, or module federation needs arise), nx is worth evaluating. For now, proceed with Turbo.

---

## Phase 4 — Long-term (3+ months)

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

Replace ad-hoc Dependabot with Renovate Bot — groups minor/patch updates into weekly PRs across all workspace packages simultaneously.

---

## Dependency Graph Reference

```
sqon
 └─ types
     └─ graphql-router
         ├─ search-server
         └─ integration-tests/server   ← cache: false (ES-dependent)

components                             ← independent of server chain
 └─ charts
 └─ integration-tests/import
```

When `sqon` changes, `--filter=[HEAD^1]` automatically includes `types`, `graphql-router`, `search-server`, and `integration-tests/server` via the `^build` dependency chain.
