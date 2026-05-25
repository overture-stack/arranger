# Arranger MCP Server Foundation

This app is the starting point for an MCP server that learns how to talk to Arranger by consuming Arranger's introspection endpoints.

The current scaffold does not implement a full MCP transport or SDK binding yet. Instead, it defines:

- how to read Arranger introspection
- how to model that information as MCP-friendly resources
- which MCP tools are natural to expose first

## Why this exists

The intended flow is:

1. call Arranger's `/introspection`
2. call Arranger's `/introspection/sqon`
3. call Arranger's `/introspection/:catalogId`
4. expose those results to MCP clients as resources and tool-backed lookups

## Tools vs skills

In this context:

- **tools** are callable operations an MCP client can invoke, such as "list catalogs" or "get SQON schema"
- **resources** are readable documents the MCP client can fetch, such as the server introspection payload or a catalog field listing
- **skills** are not part of the MCP standard itself; they are higher-level agent behaviors or authored instructions layered on top of tools/resources

For this scaffold, the important MCP building blocks are tools and resources.

## Folder layout

```text
src/
  arranger/
    client.ts      # fetches Arranger introspection endpoints
    types.ts       # response types for introspection payloads
  mcp/
    resources.ts   # MCP-facing resource definitions backed by introspection
    tools.ts       # MCP-facing tool definitions backed by introspection
    types.ts       # simple MCP-ish types for the scaffold
  config.ts        # env/config parsing for the future MCP server
  index.ts         # composition entrypoint for the scaffold
```

## Intended first MCP features

- `list_catalogs`
- `get_sqon_schema`
- `get_catalog_fields`

Those all map directly to already-implemented Arranger introspection endpoints.

## Not implemented yet

- actual MCP SDK bootstrap
- stdin/stdout server transport
- authentication
- query execution tools
- SQON generation helpers beyond introspection exposure

## Suggested next step

When you're ready to implement the actual MCP server, keep this app focused on:

- fetching and caching Arranger introspection
- exposing catalog and SQON metadata to MCP clients

Then add query execution tools only after the metadata contract feels stable.
