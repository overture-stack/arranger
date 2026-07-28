# Arranger MCP Server

This app is an MCP server that learns how to talk to Arranger by consuming Arranger's introspection endpoints.

The current scaffold implements the Streamable HTTP MCP transport using **v1.x** of the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x).

## Folder Structure

```text
src/
├── arranger/
│   ├── client.ts               # fetches Arranger introspection endpoints
│   ├── queryBuilder.ts         # utilities for building GQL queries
│   ├── queryResults.ts         # utilities for compressing GQL query results
│   ├── queryValidation.ts      # Arranger query validation
│   ├── types.ts                # response types for introspection payloads
│   └── validation.ts           # validates the connection to Arranger
├── http/
│   └── app.ts                  # MCP express app with Streamable HTTP transport
├── mcp/
│   ├── executeQueryTool.ts     # execute query tool
│   ├── resources.ts            # registers MCP resources
│   └── tools.ts                # registers MCP tools
├── utils/
│   ├── config.ts               # env/config parsing
│   ├── errors.ts               # error handling utilities
│   ├── inMemoryEventStore.ts   # in-memory storage util for dev
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

An example environment variables file is located at [`.env.schema`](./.env.schema). This example file lists all available configuration variables and is prepopulated with default values that should work to run the application locally. You can copy the contents of this file to populate a `.env`:

```bash
# from apps/mcp-server
cp .env.schema .env
```

### Environment Variables

| Name                          | Description                                                             | Type     | Required     | Default                 |
| ----------------------------- | ----------------------------------------------------------------------- | -------- | ------------ | ----------------------- |
| `ARRANGER_BASE_URL`           | URL for the Arranger Server                                             | `string` | **Required** | `http://localhost:5050` |
| `ARRANGER_CATALOGUES`         | Comma-separated list of Arranger catalogues to expose to the MCP Server | `string` | **Required** | `server`                |
| `ARRANGER_REQUEST_TIMEOUT_MS` | Timeout for requests to Arranger                                        | `number` | Optional     | `10_000`                |
| `MCP_HOST`                    | Host URL for the MCP server                                             | `string` | Optional     | `0.0.0.0`               |
| `MCP_PORT`                    | Port the MCP Server will listen for requests on                         | `number` | Optional     | `3100`                  |
| `MCP_PATH`                    | Endpoint for the MCP Streamable HTTP transport                          | `string` | Optional     | `/mcp`                  |
| `LOG_LEVEL`                   | Pino [log level](https://getpino.io/#/docs/api?id=level-1)              | `string` | Optional     | `info`                  |

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
