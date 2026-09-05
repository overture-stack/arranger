# Arranger MCP Server

This app is an MCP server that learns how to talk to Arranger by consuming Arranger's introspection endpoints.

It serves the Streamable HTTP transport on **v2** of the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), speaking protocol revision **`2026-07-28`**.

## Tools

The server registers five tools that cover the full query lifecycle:

| Tool                   | Purpose                                                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_catalogues`      | Returns the catalogues the connected Arranger exposes.                                                                                                                                                                                   |
| `get_sqon_schema`      | Returns a compact SQON quick reference (grammar, operators, worked examples) plus the full machine-readable SQON JSON Schema.                                                                                                            |
| `get_catalogue_fields` | Returns field introspection for one catalogue: each field's type, display name, unit, description, and valid operators.                                                                                                                  |
| `build_sqon`           | Builds a validated SQON from plain field, operator, and value clauses, with a plain-English summary. Builds only; it executes nothing.                                                                                                   |
| `execute_query`        | Builds, confirms, and executes a SQON-filtered query against a catalogue and returns the matching records. Requires a client that supports elicitation, and refuses one that does not, since the query must be confirmed before it runs. |

The intended call order is `list_catalogues` → `get_catalogue_fields` → `build_sqon` → `execute_query`, which is what `SERVER_INSTRUCTIONS` and the `query_arranger` prompt both describe. `build_sqon` covers every operator `modules/sqon` implements: the single-field operators (`in`, `not-in`, `some-not-in`, `all`, `gt`, `gte`, `lt`, `lte`, `between`) with `fieldName`, and `wildcard` text search across several fields with `fieldNames`. Mixed combinators and the planned `fuzzy` operator are not supported, so those still need a hand-written `sqon` passed to `execute_query`.

## Folder Structure

Tests are co-located (`*.test.ts` beside the file they cover) and omitted below.

```text
src/
├── arranger/
│   ├── clauseValidation.ts     # validates build_sqon clauses against a catalogue
│   ├── client.ts               # fetches Arranger introspection endpoints
│   ├── queryBuilder.ts         # utilities for building GQL queries
│   ├── queryResults.ts         # utilities for compressing GQL query results
│   ├── queryValidation.ts      # Arranger query validation
│   ├── sqonSummary.ts          # renders a SQON as plain English, and counts its clauses
│   ├── types.ts                # response types for introspection payloads
│   └── validation.ts           # validates the connection to Arranger
├── http/
│   ├── requestBody.ts          # reads and size-caps the request body
│   └── server.ts               # serves the MCP handler on node:http, with Host and Origin guards
├── mcp/
│   ├── buildSqonTool.ts        # build SQON tool
│   ├── cacheHints.ts           # freshness hints published on cacheable results
│   ├── executeQueryTool.ts     # execute query tool
│   ├── instructions.ts         # server instructions, returned by server/discover
│   ├── prompts.ts              # registers MCP prompts
│   ├── requestState.ts         # signs and verifies execute_query's confirmation state
│   ├── resources.ts            # registers MCP resources
│   ├── sqonCheatSheet.ts       # compact SQON reference, returned by get_sqon_schema
│   └── tools.ts                # registers MCP tools
├── utils/
│   ├── config.ts               # env/config parsing
│   ├── errors.ts               # error handling utilities
│   └── logger.ts               # pino logger wrapper
├── index.ts                    # entrypoint for the application
└── server.ts                   # creates the MCP server
```

## Quick Start

1. Install dependencies:

```bash
# from project root
npm ci
```

2. Configure environment variables:

> [!NOTE]
> See [Configuration](#configuration) for more details.

```bash
# from apps/mcp-server
cp .env.schema .env
```

3. Build Arranger modules:

```bash
# from project root
npm run modules:build
```

4. (Optional) Ensure Elasticsearch and Arranger Server are running.

> [!NOTE]
> This is only necessary if you are developing against a local Arranger Server. See [Testing](#testing) for more details.

```bash
# from project root
make start-es
ES_INDEX=file_centric DOCUMENT_TYPE=file CONFIGS_PATH=$(pwd)/docker/server npm run dev:server
```

5. Start the MCP Server:

```bash
# from project root
npm run mcp-server:dev
```

## Configuration

Configuration of this application is done by providing [environment variables](#environment-variables) to the application at run time.

> [!WARNING]
> If **required** environment variables are not available or misconfigured at run time, the application will shut down immediately.

An example environment variables file is located at [`.env.schema`](./.env.schema). This example file lists all available configuration variables, prepopulated so the application runs locally as-is. It sets `MCP_ALLOWED_HOSTS` explicitly because the default `MCP_HOST` of `0.0.0.0` binds every interface, which requires an allowlist; see the table below. You can copy the contents of this file to populate a `.env`:

```bash
# from apps/mcp-server
cp .env.schema .env
```

### Environment Variables

| Name                          | Description                                                                                                                                                                                                                                                                                                                                                                               | Type     | Required     | Default                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ | ------------------------------------------------------- |
| `ARRANGER_BASE_URL`           | URL for the Arranger Server                                                                                                                                                                                                                                                                                                                                                               | `string` | **Required** | `http://localhost:5050`                                 |
| `ARRANGER_CATALOGUES`         | Comma-separated list of Arranger catalogues to expose to the MCP Server                                                                                                                                                                                                                                                                                                                   | `string` | **Required** | `server`                                                |
| `ARRANGER_REQUEST_TIMEOUT_MS` | Timeout for requests to Arranger                                                                                                                                                                                                                                                                                                                                                          | `number` | Optional     | `10_000`                                                |
| `MCP_HOST`                    | Interface the MCP Server binds to. A loopback value (`127.0.0.1`, `localhost`, `::1`) defaults both allowlists below to the localhost hostnames; any other value requires `MCP_ALLOWED_HOSTS`.                                                                                                                                                                                            | `string` | Optional     | `0.0.0.0`                                               |
| `MCP_PORT`                    | Port the MCP Server will listen for requests on                                                                                                                                                                                                                                                                                                                                           | `number` | Optional     | `3100`                                                  |
| `MCP_PATH`                    | Endpoint for the MCP Streamable HTTP transport                                                                                                                                                                                                                                                                                                                                            | `string` | Optional     | `/mcp`                                                  |
| `MCP_ALLOWED_HOSTS`           | Comma-separated hostnames clients use to reach this server (e.g. `arranger-mcp,mcp.example.org`), matched against the `Host` header for DNS rebinding protection. **Required whenever `MCP_HOST` is not loopback**: the server exits at startup rather than bind a routable interface unguarded. Set it to `*` only when an upstream gateway validates `Host` on your behalf.             | `string` | Conditional  | localhost hostnames on a loopback bind                  |
| `MCP_ALLOWED_ORIGINS`         | Comma-separated browser origin hostnames allowed to call this server. An empty list is still a live check, not a disabled one: a request carrying no `Origin` header (every non-browser MCP client) passes, and any browser origin is refused.                                                                                                                                            | `string` | Optional     | localhost hostnames on a loopback bind, otherwise empty |
| `MCP_REQUEST_STATE_SECRET`    | HMAC key the server signs `execute_query` confirmations with, so the query a user approves is the query that runs. Must be at least 32 bytes. Unset, the server generates one per process, which is correct at a single replica: in-flight confirmations do not survive a restart, and every confirmation fails across multiple instances. Set a shared value when running more than one. | `string` | Optional     | a key generated per process                             |
| `MCP_MAX_BODY_BYTES`          | Largest request body accepted, in bytes; anything above it is refused with `413`. The default preserves the `100kb` limit `express.json()` applied before this app served MCP on plain `node:http`, which the MCP SDK does not replace. Raise it if a legitimate payload is found to exceed it, for example an `execute_query` SQON filtering on a very large set of identifiers.         | `number` | Optional     | `102_400` (100kb)                                       |
| `LOG_LEVEL`                   | Pino [log level](https://getpino.io/#/docs/api?id=level-1)                                                                                                                                                                                                                                                                                                                                | `string` | Optional     | `info`                                                  |

## Testing

### Local Arranger

To test the MCP Server against a **local** instance of Arranger Server:

1. Confirm your [`apps/mcp-server/.env`](.env) configuration aligns with your local Arranger server.

2. Ensure ES and Arranger Server are running:

```bash
# from project root

# start ES (note: you may need to seed ES with `make seed-es` after if this is your first time)
make start-es

# start Arranger Server (config may vary)
ES_INDEX=file_centric DOCUMENT_TYPE=file CONFIGS_PATH=$(pwd)/docker/server npm run dev:server
```

3. Start the MCP Server:

```bash
# from project root
npm run mcp-server:dev
```

4. Start the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# from project root
npm run mcp-server:inspect
```

5. You can then open the MCP Inspector URL in your web browser (`http://localhost:6274/?MCP_PROXY_AUTH_TOKEN={AUTH_TOKEN}`), connect to the MCP Server via Streamable HTTP, and test the Resources and Tools.

### Remote Arranger

To test against a **remote** instance of Arranger Server:

1. Update the `ARRANGER_BASE_URL` and `ARRANGER_CATALOGUES` in your MCP Server `.env` file to point to and reflect the state of your remote Arranger.
2. Follow steps 3-5 of the [**local**](#local-arranger) testing instructions.

### LM Studio

To test with **LM Studio** instead of MCP Inspector:

- Follow the LM Studio instructions to add an MCP server configuration: https://lmstudio.ai/docs/app/mcp
    - Provide the config JSON in [`apps/mcp-server/mcp-inspector.json`](./mcp-inspector.json)

## Not Implemented Yet

- stdin/stdout server transport
- authentication
- SQON generation helpers beyond introspection exposure
