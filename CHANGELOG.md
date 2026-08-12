# Changelog

All notable changes to this project are documented here.

This file covers high-level release notes for the Arranger project as a whole. When Changesets is adopted (see roadmap Phase 3.1), individual packages will also gain their own `CHANGELOG.md` files generated automatically at publish time. This root file is maintained by hand and covers operator- and integrator-facing changes.

---

## [3.1.0] - Unreleased

### Breaking changes

- **Environment variable `PORT` renamed to `SERVER_PORT`**: Update `.env` files, container configs, and Helm values.
- **Environment variable `SEARCH_CLIENT_TYPE` renamed to `SEARCH_ENGINE`**: Accepts `opensearch` or `elasticsearch`. Leave unset to auto-detect from the cluster.
- **Docker image `arranger-server` renamed to `arranger-search-server`**: Update `docker-compose.yml`, Helm values, and any deployment manifests.
- **`MAX_RESULTS_WINDOW` is now enforced**: Previously present in the env schema but not applied; now caps query results at `10000` by default. Deployments that return more than 10,000 documents must set this explicitly (via env var or per-catalogue `table.json`).

See [docs/reference/08-Migration/v3.1.md](docs/reference/08-Migration/v3.1.md) for upgrade instructions.

---

### Architecture

- **Server abstracted into its own application** (`apps/search-server`): The Arranger search server is now a separate app rather than part of the main module, making the core routing logic in `modules/graphql-router` easier to compose in custom deployments.
- **New `modules/sqon` package** (`@overture-stack/arranger-sqon`): Centralises SQON schema definitions, operator metadata, and validation. Shared by server and client code.

### Types (`@overture-stack/arranger-types`)

- **`table.columns`, `facets.aggs`, `sets.index`/`type`, and `charts.query` are now optional**: none of these are validated by `arrangerRouter`'s own config validation, and all are given complete defaults when omitted, so requiring them from callers didn't match how they're actually used (matching how `downloads`'s fields were already optional). Non-breaking: any config that already provided these continues to work unchanged.

### Server

- **Multicatalogue support**: A single Arranger server can now serve multiple catalogues simultaneously. Organise configs in subdirectories under `CONFIGS_PATH` (one subdirectory per catalogue). Existing flat layouts continue to work as single-catalogue deployments: no migration required.
- **Catalogue-scoped paths accept a `documentType`, not just a `catalogueId`**: `/{catalogueId}/graphql` and `GET /introspection/:catalogueId` now also resolve a `documentType`, provided it names exactly one catalogue on the server. A real `catalogueId` is always checked first and always wins, so this can't be shadowed by a same-named `documentType`. A `documentType` shared by more than one catalogue returns `409` (`ambiguous_document_type`) listing every matching `catalogueId`, rather than silently picking one. See [docs/reference/05-introspection.md](docs/reference/05-introspection.md#catalogueid-also-accepts-a-documenttype).
- **Partial catalogue availability**: A catalogue whose search index is missing or unreachable no longer crashes the whole server. It's reported as `failed` (with an `error` object: a machine-readable `code` and a human-readable `message`) in `GET /introspection` and its own `GET /introspection/:catalogueId`, alongside a server-wide `status` (`healthy`/`degraded`/`unhealthy`). Its GraphQL endpoint returns `404` instead of taking the process down. New `GET /ready` readiness endpoint reflects this aggregate for orchestration probes. `GET /ping` (liveness) is unaffected and stays blind to catalogue state on purpose, so a search-engine outage doesn't trigger a restart loop. New `READY_PATH` env var (default `/ready`), mirrors `PING_PATH`. A failing catalogue's full stack trace and cause chain is only printed to the console when `enableDebug` is set: by default, only the curated `code`/`message` summary is logged, keeping routine startup output readable when several catalogues load concurrently. New `permission_denied` error code, for a search engine user lacking the permissions needed to read its index or mapping. A catalogue whose GraphQL schema or endpoint fails to build is now correctly reported as `failed` with the new `schema_build_error` code, instead of being silently mounted as `available` while every request under it returned a generic `500`.
- **New `nestingPrefix` catalogue config**: for a catalogue whose real index documents wrap all their content under one top-level envelope property (for example a Lyric-sourced catalogue, which nests everything under `data`), setting `nestingPrefix` (a dotted path, e.g. `"data"` or `"envelope.payload"` for deeper envelopes) unwraps the mapping at that path during schema generation, so `extended.json`/`facets.json`/`table.json` can keep referencing clean, unprefixed field names (mapping ingestion), and every filter, aggregation, sort, and response read re-applies the prefix against the real ES paths transparently (per-request query/response translation), so a catalogue with `nestingPrefix` set behaves identically, end to end, to one whose documents were never wrapped in the first place. A configured value that doesn't match the real mapping fails the catalogue at startup (new `nesting_prefix_not_found` error code, reported via `GET /introspection` like any other catalogue failure) rather than silently falling back and reproducing the exact "everything is null" symptom this feature exists to fix. See [docs/reference/01-arranger-configs.md](docs/reference/01-arranger-configs.md#nestingprefix-optional) for full detail, including a documented bandwidth tradeoff and a field-level-access-control caveat for future work.
- **Field names with characters GraphQL can't use as identifiers now work** (e.g. a hyphen or leading digit, common in some biomarker/clinical naming conventions): previously any such field crashed schema generation outright. These are now sanitized into valid GraphQL identifiers automatically; `extended.json`/`table.json`/`facets.json` continue to reference fields by their natural raw path, no config changes required. `facets.json` specifically can now reference nested fields by their raw dotted path too (e.g. `"donor.age"`); the previous `__`-escaped form (`"donor__age"`) still works but is deprecated, see [migration guide](docs/migration/v3.1.md). The one case sanitization can't resolve automatically, two distinct raw field names colliding on the same sanitized identifier, still fails with `schema_build_error`, naming the specific colliding fields.
- **Introspection API**: New REST endpoints for tooling and LLM integration:
    - `GET /introspection`: Lists all registered catalogues with their document types, GraphQL paths, introspection paths, and availability `status`.
    - `GET /introspection/:catalogueId`: Returns all fields for a catalogue, their ES types, and valid SQON operators grouped by field type.
    - `GET /introspection/sqon`: Returns the SQON JSON Schema.
    - See [docs/reference/05-introspection.md](docs/reference/05-introspection.md) for full API reference.
- **Network search federation**: A catalogue can federate queries across multiple remote Arranger nodes via `network.json` config. Supports passthrough headers for forwarding auth tokens to remote nodes.
- **GraphQL query complexity limits**: Configurable alias count and query depth limits protect against abusive queries. Set via `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` env vars or per-catalogue config. Unset by default.
- **CORS configuration**: `ALLOWED_CORS_ORIGINS` env var controls which origins are permitted. Omit to allow all.
- **Catalogue descriptions**: Add an optional `"description"` field to `base.json` to surface a human-readable label in introspection responses.
- **`ROW_ID_FIELD_NAME` configurable**: The ES field used as the row identifier (default `id`). Previously hardcoded.
- **`DOWNLOAD_STREAM_BUFFER_SIZE` default corrected**: Fixed incorrect default of `100`; now `2000` as documented.
- **Fixed: `downloads.maxRows`/`downloads.allowCustomMaxRows` were never enforced**: `getAllData` referenced config property names that didn't exist, so every download ran completely uncapped regardless of configuration. Downloads are now correctly capped at the configured `maxRows` (default `100`), or a caller-supplied value when `allowCustomMaxRows` is set.

### MCP server

- **New `apps/mcp-server`**: A Model Context Protocol server that exposes Arranger catalogues as LLM-queryable resources and tools. Separate Docker image: `ghcr.io/overture-stack/arranger-mcp-server`. Implements the MCP Streamable HTTP transport.
    - Resources: server introspection, SQON schema, per-catalogue fields.
    - Tools: `list_catalogues`, `get_sqon_schema`, `get_catalogue_fields`, `build_sqon`, `execute_query`.
- **`build_sqon` tool**: builds a validated SQON from plain `fieldName`/`operator`/`value` clauses, so a model selects conditions instead of writing query JSON. Every clause is checked against the catalogue's own field types and valid operators before anything is built, and one error is reported per invalid clause rather than stopping at the first, so a whole batch can be corrected in one resubmission. Returns the SQON alongside a plain-English `summary` built from the catalogue's display names (for reading back to the user before the query runs), and reports when equivalent clauses merged during the build so a lower filter count than was submitted is explained rather than silent. Optionally extends the SQON from an earlier call via `existingSqon`, for narrowing a query that already ran. Version 1 covers the scalar operators (`in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`) with one `and`/`or` per call; text-search operators and mixed AND/OR nesting still require a hand-written `sqon` passed to `execute_query`. The server instructions, `execute_query`'s description, and the `query_arranger` prompt now all route SQON construction through this tool. See [docs/mcp-server.md](docs/mcp-server.md) for the full tool surface.

### Charts (`@overture-stack/arranger-charts`)

The charts module was introduced in this release cycle as a new package.

- **Bar chart**: Responsive bar chart with configurable colours, tooltips, and sorting. New in 3.1:
    - Zero-value suppression: bars with a data value of exactly `0` render a small visible stub rather than being invisible.
    - `disableIncludeMissing` option to exclude the "missing values" bucket.
    - Configurable bottom-axis tick values.
    - "Top X of Y" display showing how many bars are visible vs. the total bucket count.
    - Max bars configurable.
    - Sortable by label (in addition to by value).
    - Tooltip text wraps on long labels.
    - Y axis offset corrected.
- **Sunburst chart**: Hierarchical proportional chart using nivo, with mapper and max-segments support.
- **Numeric aggregations**: Range query support and improved range handling.
- **Theming**: Theme prop for operator customization of chart appearance.
- **Colour persistence**: Selected colours are saved to `sessionStorage` and restored across page loads.
- **Configurable loading delay**: Control the loading state transition duration.
- **Composable architecture**: Charts refactored to use hooks and single-responsibility context providers rather than a monolithic do-everything component.
- **Consistent tooltips**: Shared tooltip component and CSS classes used across all chart types, enabling consumer styling via standard class selectors.
- **Fixed: `useNetworkQuery`/`ChartsProvider` ignored `catalogue` scoping entirely**: same root cause as the `Aggregations`/`QuickSearch` bugs in `arranger-components` (see Components section): `ChartsProvider` pulled `apiFetcher` from `useArrangerData()` context but never forwarded `apiUrl`, so every chart's network/aggregation query silently went to the unscoped default in multicatalogue mode. Fixed by threading `apiUrl` through `ChartsProvider` → `useNetworkQuery` → `apiFetcher`'s `url`; the fetch-args construction was extracted as `buildNetworkQueryFetchArgs` for direct unit testing.

### Components (`@overture-stack/arranger-components`)

- **Select all on facet panel**: Facet term aggregations now include a "select all" button to select every visible bucket at once.
- **Column width themability**: Table header column widths are now configurable via the theme prop.
- **Quoted string search in QuickSearch**: Quoted phrases are preserved as a single search token rather than split on whitespace.
- **Large TSV download**: Streaming download for large result sets restored; handles files that exceed the default row limit.
- **Accessibility improvements**: Table headers, row count selector, and pagination controls updated for keyboard navigation and screen reader compatibility.
- **Non-SSR config compatibility**: Fixed a type error in config resolution that surfaced in non-server-rendered environments.
- **`SQONViewer` multi-value bubble regression fixed**: A filter with multiple values (e.g. an `in` filter matching several values) was collapsing into one joined bubble instead of one bubble per value, with the operator label incorrectly showing "is" instead of "in". Regressed silently for over a year; now covered by a unit test on the underlying value-normalization logic.
- **New `catalogue` prop on `DataProvider`**: Scopes a provider to one catalogue on a multicatalogue Arranger server. Omit for existing single-catalogue deployments (unchanged behaviour); set `catalogue="my-catalogue-id"` to route that provider's requests to `{apiUrl}/my-catalogue-id/graphql` instead of `{apiUrl}/graphql`. **If you pass a `customFetcher`, it must honour the `url` field it receives** rather than hardcoding a fixed base URL: `DataProvider` resolves `apiUrl` and `catalogue` into that field before every request, and a fetcher that ignores it will silently keep hitting the unscoped base URL.
- **`documentType` on `DataProvider` is now optional, resolved automatically from `catalogue`**: omit it and `DataProvider` calls the new `useArrangerConfig` hook internally (`GET /{catalogue}/introspection`) to discover it, replacing the deprecated `hasValidConfig` GraphQL query's role as a startup validity check in the process; a resolution failure (catalogue not found, or an ambiguous `documentType`) surfaces on context as `catalogueError` instead of a confusing downstream query failure. Adds one request before real queries can start when used this way; passing `documentType` explicitly (every existing consumer) skips the lookup entirely, unchanged. `useArrangerConfig` is also exported for standalone use, to validate one or more catalogues before rendering anything. `APIFetcherFn`'s `body` is now optional, needed for the hook's body-less `GET` request, and it gained a `signal` field (an `AbortSignal`) so a stale request can be cancelled outright when `catalogue` changes mid-flight, rather than just having its result ignored; both are additive, and any existing `customFetcher` is unaffected either way.
- **Fixed: aggregation/facet panels (`Aggregations`) ignored `catalogue` scoping entirely**: unlike the main table (which resolves its base URL through `DataProvider`'s own `fetchData`), `Aggregations` pulled the raw, unscoped `apiFetcher` from context and never forwarded the resolved `apiUrl` into its own query path (`AggsQuery`), so facet queries silently went to the wrong catalogue in multicatalogue mode, or the wrong server for any single-catalogue deployment where `apiUrl` differs from the `ARRANGER_API` env default. Fixed by threading `apiUrl` through `Aggregations` → `AggsQuery` → the underlying `Query`'s `url`. No effect on a deployment where `apiUrl` already matched `ARRANGER_API` (the common case, including every deployment not using `catalogue` at all).
- **Fixed: `QuickSearch` had the identical bug**: same root cause and fix as `Aggregations` above, found in the same audit. `QuickSearch` pulled `apiFetcher` from context but never forwarded `apiUrl`; `QuickSearchQuery`'s options builder (now extracted and exported as `getQuickSearchQueryOptions`) now includes `url: apiUrl`.
- **Fixed: `useArrangerTheme`/`withArrangerTheme` couldn't unset a previously-set theme value**: theme aggregation merged every caller's contribution into one ever-growing accumulator, additively, forever; removing a key or shrinking an array from a later render had nothing to overlay onto the stale value, so it silently persisted (only a full remount, not a re-render, ever cleared it). Each caller's contribution is now tracked and replaced wholesale on every call instead, then the effective theme is re-derived fresh from all callers' current contributions. Two related gaps fixed in the same pass: array-valued theme properties (e.g. `Table.defaultSorting`) were merged element-by-element by index rather than replaced wholesale, so shrinking one left stale trailing entries; and the old change-detection (`JSON.stringify` equality) silently ignored function-valued properties entirely, so a change confined to a callback body never propagated. The equality check now compares real values (correctly catching key removals, array-length changes, and reordering) while still deliberately treating any two functions as equal, to avoid a re-render on every render of a theme carrying an inline callback.

### SQON operators

- **`wildcard` is now the canonical op for text-pattern search**: The operator that performs case-insensitive substring matching across multiple fields was previously named `filter`. That name was misleading in two ways: it collides with the generic meaning of "filter" (every SQON op is a filter), and it falsely implies fuzzy/approximate matching, which is a distinct ES/OS feature (Levenshtein edit-distance) that does not exist yet. The operation is implemented with an ES/OS `wildcard` query, so `wildcard` is the name it carries going forward.

    `filter` is accepted as an alias and normalizes to `wildcard` at query-build time; existing serialized SQONs continue to work without any migration. New SQONs should use `op: "wildcard"`.

- **`VersionedSqonJsonSchema`, `SqonJsonSchema`, and `JsonSchemaObject` now exported from the package root**: previously only reachable through an internal path. Needed by any consumer that wants to reference the real shape of `getVersionedSqonJsonSchema()`'s return value instead of a hand-duplicated, looser type.

- **All operator aliases now normalize on parse, not just `filter`/`wildcard`**: `SqonBuilder.from()` rewrites every leaf's `op` to its canonical form (`=` -> `in`, `>=` -> `gte`, `filter` -> `wildcard`, etc.) before returning, recursively through nested combinations. Previously the schema validated aliases but never normalized them, so code that switched on `.op` after parsing (rather than going through the builder's own methods) could accept a query using an alias and then fail to match any canonical branch. Calling `SqonSchema.parse()` directly still returns the alias unchanged; use the newly-exported `normalizeSqonNode()` if you have a reason to validate without the builder. Also newly exported: `isGroupNode`/`isFieldFilter` type guards for discriminating a `SqonNode` by shape.

- **New `asCombination()` export, for consumers that need a stable, always-a-combination shape**: `SqonBuilder` always collapses a single-item `and`/`or` down to its sole child (`SqonBuilder.and([oneFilter]).toValue()` returns `oneFilter`, not `{ op: 'and', content: [oneFilter] }`), the same behavior `sqon-builder` had. That's the right default for the common case, but it surprised a consumer whose SQON-rendering code assumed the top level was always a combination with `content` as an array, and crashed the moment a lone filter collapsed to a bare leaf. `asCombination(node, op = 'and')` wraps a node in a combination if it isn't already one, and never unwraps a single-item result the way builder methods do, use it instead of a hand-written `{ op: 'and', content: [node] }` literal wherever that stability matters more than the minimal form.

### Infrastructure

- **Turborepo**: Build and test pipeline uses Turborepo for change detection: only affected packages and their dependents rebuild on each commit.
- **`npm run release:check`**: New script (`scripts/verify-pack.mjs`) verifies that no publishable package contains `file:` dependency references before release.
- **`@overture-stack/sqon` no longer reads the filesystem at runtime**: Its version constant was previously computed by `readFileSync`-ing the package's own `package.json` at module-init time, a Node-only API with no browser equivalent, breaking any bundler building for a browser target (e.g. Vite) that imports the package, directly or transitively through `arranger-types`/`arranger-components`/`arranger-charts`. The version is now stamped into a generated file at build/test time instead (`scripts/generateVersion.mjs`, wired via `pretest`/`prebuild`); the shipped bundle contains no `node:fs`/`node:path`/`node:url` references. Also added `"sideEffects": false` to the package now that its module graph has no remaining top-level side effects.

---

## [3.0.0] and earlier

See git history.
