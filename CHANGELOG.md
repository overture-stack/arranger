# Changelog

All notable changes to this project are documented here.

This file covers high-level release notes for the Arranger project as a whole. When Changesets is adopted (see roadmap Phase 3.1), individual packages will also gain their own `CHANGELOG.md` files generated automatically at publish time. This root file is maintained by hand and covers operator- and integrator-facing changes.

---

## [3.1.0] - Unreleased

### Breaking changes

- **Environment variable `PORT` renamed to `SERVER_PORT`** - Update `.env` files, container configs, and Helm values.
- **Environment variable `SEARCH_CLIENT_TYPE` renamed to `SEARCH_ENGINE`** - Accepts `opensearch` or `elasticsearch`. Leave unset to auto-detect from the cluster.
- **Docker image `arranger-server` renamed to `arranger-search-server`** - Update `docker-compose.yml`, Helm values, and any deployment manifests.
- **`MAX_RESULTS_WINDOW` is now enforced** - Previously present in the env schema but not applied; now caps query results at `10000` by default. Deployments that return more than 10,000 documents must set this explicitly (via env var or per-catalogue `table.json`).

See [docs/migration/v3.1.md](docs/migration/v3.1.md) for upgrade instructions.

---

### Architecture

- **Server abstracted into its own application** (`apps/search-server`) - The Arranger search server is now a separate app rather than part of the main module, making the core routing logic in `modules/graphql-router` easier to compose in custom deployments.
- **New `modules/sqon` package** (`@overture-stack/arranger-sqon`) - Centralises SQON schema definitions, operator metadata, and validation. Shared by server and client code.

### Server

- **Multicatalogue support** - A single Arranger server can now serve multiple catalogues simultaneously. Organise configs in subdirectories under `CONFIGS_PATH` (one subdirectory per catalogue). Existing flat layouts continue to work as single-catalogue deployments — no migration required.
- **Introspection API** - New REST endpoints for tooling and LLM integration:
    - `GET /introspection` - Lists all registered catalogues with their document types, GraphQL paths, and introspection paths.
    - `GET /introspection/:catalogueId` - Returns all fields for a catalogue, their ES types, and valid SQON operators grouped by field type.
    - `GET /introspection/sqon` - Returns the SQON JSON Schema.
    - See [docs/usage/04-introspection.md](docs/usage/04-introspection.md) for full API reference.
- **Network search federation** - A catalogue can federate queries across multiple remote Arranger nodes via `network.json` config. Supports passthrough headers for forwarding auth tokens to remote nodes.
- **GraphQL query complexity limits** - Configurable alias count and query depth limits protect against abusive queries. Set via `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` env vars or per-catalogue config. Unset by default.
- **CORS configuration** - `ALLOWED_CORS_ORIGINS` env var controls which origins are permitted. Omit to allow all.
- **Catalogue descriptions** - Add an optional `"description"` field to `base.json` to surface a human-readable label in introspection responses.
- **`ROW_ID_FIELD_NAME` configurable** - The ES field used as the row identifier (default `id`). Previously hardcoded.
- **`DOWNLOAD_STREAM_BUFFER_SIZE` default corrected** - Fixed incorrect default of `100`; now `2000` as documented.

### MCP server

- **New `apps/mcp-server`** - A Model Context Protocol server that exposes Arranger catalogues as LLM-queryable resources and tools. Separate Docker image: `ghcr.io/overture-stack/arranger-mcp-server`. Implements the MCP Streamable HTTP transport.
    - Resources: server introspection, SQON schema, per-catalogue fields.
    - Tools: `list-catalogs`, `get-sqon-schema`, `get-catalog-fields`, `search-catalog`.

### Charts (`@overture-stack/arranger-charts`)

The charts module was introduced in this release cycle as a new package.

- **Bar chart** - Responsive bar chart with configurable colours, tooltips, and sorting. New in 3.1:
    - Zero-value suppression: bars with a data value of exactly `0` render a small visible stub rather than being invisible.
    - `disableIncludeMissing` option to exclude the "missing values" bucket.
    - Configurable bottom-axis tick values.
    - "Top X of Y" display showing how many bars are visible vs. the total bucket count.
    - Max bars configurable.
    - Sortable by label (in addition to by value).
    - Tooltip text wraps on long labels.
    - Y axis offset corrected.
- **Sunburst chart** - Hierarchical proportional chart using nivo, with mapper and max-segments support.
- **Numeric aggregations** - Range query support and improved range handling.
- **Theming** - Theme prop for operator customization of chart appearance.
- **Colour persistence** - Selected colours are saved to `sessionStorage` and restored across page loads.
- **Configurable loading delay** - Control the loading state transition duration.
- **Composable architecture** - Charts refactored to use hooks and single-responsibility context providers rather than a monolithic do-everything component.
- **Consistent tooltips** - Shared tooltip component and CSS classes used across all chart types, enabling consumer styling via standard class selectors.

### Components (`@overture-stack/arranger-components`)

- **Select all on facet panel** - Facet term aggregations now include a "select all" button to select every visible bucket at once.
- **Column width themability** - Table header column widths are now configurable via the theme prop.
- **Quoted string search in QuickSearch** - Quoted phrases are preserved as a single search token rather than split on whitespace.
- **Large TSV download** - Streaming download for large result sets restored; handles files that exceed the default row limit.
- **Accessibility improvements** - Table headers, row count selector, and pagination controls updated for keyboard navigation and screen reader compatibility.
- **Non-SSR config compatibility** - Fixed a type error in config resolution that surfaced in non-server-rendered environments.

### SQON operators

- **`wildcard` is now the canonical op for text-pattern search** - The operator that performs case-insensitive substring matching across multiple fields was previously named `filter`. That name was misleading in two ways: it collides with the generic meaning of "filter" (every SQON op is a filter), and it falsely implies fuzzy/approximate matching, which is a distinct ES/OS feature (Levenshtein edit-distance) that does not exist yet. The operation is implemented with an ES/OS `wildcard` query, so `wildcard` is the name it carries going forward.

    `filter` is accepted as an alias and normalizes to `wildcard` at query-build time; existing serialized SQONs continue to work without any migration. New SQONs should use `op: "wildcard"`.

### Infrastructure

- **Turborepo** - Build and test pipeline uses Turborepo for change detection: only affected packages and their dependents rebuild on each commit.
- **`npm run release:check`** - New script (`scripts/verify-pack.mjs`) verifies that no publishable package contains `file:` dependency references before release.

---

## [3.0.0] and earlier

See git history.
