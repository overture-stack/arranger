---
sidebar_position: 5
---

# Arranger MCP server

The Arranger MCP server exposes a running Arranger instance's catalogue data and query tools to AI models, scripts, and pipelines. It is one of two surfaces for that purpose; the other is the [Introspection API](./reference/05-introspection.md), a set of read-only REST endpoints that any client can call directly.

The `arranger-mcp-server` package implements the [Model Context Protocol](https://modelcontextprotocol.io/) over Streamable HTTP. Connect any MCP-compatible AI client to it and the client can discover available catalogues, retrieve field metadata and the SQON schema, and construct search queries: without needing Arranger-specific integration code on the model side.

---

## Quick start

```bash
# from the monorepo root
npm run mcp-server:dev
```

The server starts on `http://localhost:3100/mcp` by default. Two environment variables are required:

| Variable              | Description                                     |
| --------------------- | ----------------------------------------------- |
| `ARRANGER_BASE_URL`   | URL of the running Arranger search-server       |
| `ARRANGER_CATALOGUES` | Comma-separated list of catalogue IDs to expose |

All other variables (host, port, path, log level, request timeout) have sensible defaults. Copy `apps/mcp-server/.env.schema` to `apps/mcp-server/.env` to start from a working local baseline.

## What the server exposes

**Instructions** (sent once, in the `initialize` response):

The server returns a short set of usage instructions that most clients fold into the model's system prompt. It describes what the server is for, requires the model to discover catalogue names, field names, and SQON syntax through the tools below rather than recalling them, and gives the call order (`list_catalogues` → `get_catalogue_fields` → `build_sqon` → `execute_query`). Clients that ignore `instructions` still get the same rules from the tool descriptions, though later in the exchange.

**Tools** (callable actions):

- `list_catalogues`: returns the catalogues registered on this Arranger instance
- `get_sqon_schema`: returns the SQON JSON Schema and operator metadata
- `get_catalogue_fields`: returns field metadata for one catalogue (input: `catalogueId`)
- `build_sqon`: builds a validated SQON from plain field, operator, and value inputs, so a model never has to write SQON itself (input: `{ catalogueId, combination: 'and' | 'or', clauses: [{ fieldName | fieldNames, operator, value, negate? }], existingSqon? }`)
- `execute_query`: builds, confirms, and executes a SQON-filtered query against one catalogue (input: `{ catalogueId, sqon, queryType = 'hits', fields [], first = 20, offset = 0, sort, aggregationFields = [], includeMissing = true, aggregationsFilterThemselves = false }`)

`build_sqon` returns `{ sqon, summary, clauseCount, filterCount, notes? }` and executes nothing. Pass the resulting `sqon` to `execute_query` unchanged. Every clause is validated against the catalogue before a SQON is built, and one error is reported per invalid clause so that a whole batch can be corrected in a single resubmission. `summary` is a plain-English rendering of the built SQON, using the catalogue's display names, meant to be read back to the user for confirmation. `clauseCount` and `filterCount` differ when equivalent clauses on the same field merged during the build (two lower bounds on one field collapse to the stricter one, for example); `notes` explains the difference when they do.

Most clauses name one field with `fieldName` and take a value operator: `in`, `not-in`, `some-not-in`, `all`, `gt`, `gte`, `lt`, `lte`, `between`. A `wildcard` clause is the exception: it names several fields with `fieldNames` (plural) and matches when any one of them matches. Include `*` for a substring search, since `"TP53"` matches only a value that is exactly TP53 while `"*TP53*"` matches one containing it; `negate: true` expresses "does not contain". Which operators a field accepts is decided by the catalogue, not this tool, so read `operators` from `get_catalogue_fields`.

An asterisk inside an `in`, `not-in`, `some-not-in`, or `all` value is rejected, because Arranger runs such a value as a regular expression rather than matching it literally: use `wildcard` instead. `execute_query`'s raw `sqon` parameter still accepts it, so an asterisk-bearing keyword value is reachable there but not through `build_sqon`.

Two `in` clauses on the same field also merge, by combining their value lists: `status in ['active']` together with `status in ['pending']` becomes `status in ['active', 'pending']`, meaning "either". That is the correct reading on a single-valued field, where no document could satisfy both clauses at once. It is not conditional on the field's `isArray` yet, so on a field that can hold several values at once (`isArray: true`, or `null` where nothing declared it) the other reading, "every one of these must be present", is equally legitimate and the merge silently picks "either" regardless. Use the `all` operator directly when you need that reading.

One `combination` applies to the whole call. Mixed AND/OR nesting and the planned `fuzzy` operator are not yet supported: a query needing either still requires a hand-written `sqon`. An unfiltered query needs no `build_sqon` call at all; pass `{"op":"and","content":[]}` to `execute_query` directly.

**Resources** (readable data by URI):

- `arranger://introspection/server`: server-wide catalogue inventory
- `arranger://introspection/sqon`: SQON schema and operator metadata
- `arranger://introspection/catalog/{catalogueId}`: per-catalogue field metadata

**Prompts** (callable by clients):

- `query_arranger`: accepts the user's goal as an input, and returns two messages containing the "system prompt" (workflow instructions, which route SQON construction through `build_sqon`) and the user's goal

## Connecting a client

Any MCP-compatible client that supports Streamable HTTP can connect. Point it at the MCP server URL (`http://127.0.0.1:3100/mcp` with default config) and use transport type `streamable-http`.

**MCP Inspector** is useful during development: it's a browser-based UI for browsing resources and calling tools:

```bash
npm run mcp-server:inspect
```

For **LM Studio** and other model hosts, follow the client's documentation to add an MCP server entry. The connection config lives at `apps/mcp-server/mcp-inspector.json` as a starting point.

---

## SQON generation

A model connected over MCP should not construct SQON at all: `build_sqon` does it, from field, operator, and value inputs the model selects out of `get_catalogue_fields`. That is the whole point of the tool, so the rules below are enforced rather than merely documented, and a mistake is reported per clause instead of surfacing as an Arranger query error.

The rest of this section is for a client constructing SQON directly, without the MCP server: a script, a pipeline, or the cases `build_sqon` does not yet cover (mixing AND and OR in one query, and the planned `fuzzy` operator). Use the [introspection API](./reference/05-introspection.md) to derive field names, types, and valid operators at runtime rather than hard-coding them. This keeps the client current when a catalogue mapping changes.

Safe defaults for programmatic SQON construction:

- Use canonical operator names (`in`, `not-in`, `gt`, `wildcard`, etc.); do not use aliases (`=`, `!=`, `filter`)
- A single condition can be a bare leaf node: no wrapping `and` is needed
- `gt`, `gte`, `lt`, `lte` take a single scalar value; `between` takes exactly `[min, max]`
- Preserve falsy values: `0`, `""`, and `false` are valid and must not be filtered out before construction
- Every operator except `wildcard` uses `fieldName` (string); `wildcard` uses `fieldNames` (array or string): this is a schema constraint, not a convention
- Do not invent `pivot` values; derive them from the live catalogue mapping or omit them
- Use `not-in` for value exclusion, not `not { in: [...] }`: combining the two is a double negative

For a detailed walkthrough of the SQON format and how to compose queries, see [Building SQON queries](./reference/03-building-sqon-queries.md).

---

## What's coming

- **`build_sqon` mixed combinators and fuzzy search**: mixing AND and OR in one query, and the `fuzzy` (edit-distance) operator, are still to come
- **Authentication**: the MCP server currently requires no auth; support is planned
- **Chat interface**: a conversational front-end for non-technical users to search catalogues in plain language
