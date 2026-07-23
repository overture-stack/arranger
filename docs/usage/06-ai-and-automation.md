# AI and automation

Arranger exposes its catalogue data and query tools to AI models, scripts, and pipelines through two surfaces: a REST introspection API and a dedicated MCP server. This page introduces both and points to where to go next.

---

## MCP server

The `arranger-mcp-server` package implements the [Model Context Protocol](https://modelcontextprotocol.io/) over Streamable HTTP. Connect any MCP-compatible AI client to it and the client can discover available catalogues, retrieve field metadata and the SQON schema, and construct search queries: without needing Arranger-specific integration code on the model side.

### Quick start

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

### What the server exposes

**Tools** (callable actions):

- `list_catalogues`: returns the catalogues registered on this Arranger instance
- `get_sqon_schema`: returns the SQON JSON Schema and operator metadata
- `get_catalogue_fields`: returns field metadata for one catalogue (input: `catalogueId`)
- `execute_query`: builds, confirms, and executes a SQON-filtered query against one catalogue (input: `{ catalogueId, sqon, queryType = 'hits', fields [], first = 20, offset = 0, sort, aggregationFields = [], includeMissing = true, aggregationsFilterThemselves = false }`)

**Resources** (readable data by URI):

- `arranger://introspection/server`: server-wide catalogue inventory
- `arranger://introspection/sqon`: SQON schema and operator metadata
- `arranger://introspection/catalog/{catalogueId}`: per-catalogue field metadata

### Connecting a client

Any MCP-compatible client that supports Streamable HTTP can connect. Point it at the MCP server URL (`http://127.0.0.1:3100/mcp` with default config) and use transport type `streamable-http`.

**MCP Inspector** is useful during development: it's a browser-based UI for browsing resources and calling tools:

```bash
npm run mcp-server:inspect
```

For **LM Studio** and other model hosts, follow the client's documentation to add an MCP server entry. The connection config lives at `apps/mcp-server/mcp-inspector.json` as a starting point.

---

## SQON generation

When constructing SQONs from a script, pipeline, or model, use the [introspection API](./05-introspection.md) to derive field names, types, and valid operators at runtime rather than hard-coding them. This keeps the client current when a catalogue mapping changes.

Safe defaults for programmatic SQON construction:

- Use canonical operator names (`in`, `not-in`, `gt`, `wildcard`, etc.); do not use aliases (`=`, `!=`, `filter`)
- A single condition can be a bare leaf node: no wrapping `and` is needed
- `gt`, `gte`, `lt`, `lte` take a single scalar value; `between` takes exactly `[min, max]`
- Preserve falsy values: `0`, `""`, and `false` are valid and must not be filtered out before construction
- Every operator except `wildcard` uses `fieldName` (string); `wildcard` uses `fieldNames` (array or string): this is a schema constraint, not a convention
- Do not invent `pivot` values; derive them from the live catalogue mapping or omit them
- Use `not-in` for value exclusion, not `not { in: [...] }`: combining the two is a double negative

For a detailed walkthrough of the SQON format and how to compose queries, see [Building SQON queries](./03-building-sqon-queries.md).

---

## What's coming

- **`build_sqon` tool**: a structured input tool for constructing SQON filter clauses without knowing the raw format; tracked in `.dev/docs/build-sqon-tool.md`
- **Authentication**: the MCP server currently requires no auth; support is planned
- **Chat interface**: a conversational front-end for non-technical users to search catalogues in plain language
