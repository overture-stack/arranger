# `@overture-stack/arranger-graphql-router`

Core GraphQL routing library for a single Arranger catalogue. Converts an Elasticsearch or OpenSearch index into a working GraphQL API with faceted search, aggregations, SQON filtering, download support, and optional network search federation.

This module is the engine inside [`apps/search-server`](../../apps/search-server). It can also be used directly to embed Arranger search into a custom Express application.

---

## Installation

```bash
npm install @overture-stack/arranger-graphql-router
```

## Quick start

```ts
import express from 'express';
import arrangerRouter from '@overture-stack/arranger-graphql-router';

const app = express();

const router = await arrangerRouter({
  configs: {
    esHost: 'http://localhost:9200',
    esIndex: 'file_centric',
    documentType: 'File',
  },
});

app.use('/graphql', router);
app.listen(5050);
```

For a production-ready setup with multicatalogue support, config file loading, environment variable wiring, and introspection endpoints, use [`apps/search-server`](../../apps/search-server) directly.

---

## API

### `arrangerRouter(options)` — default export

Creates and returns an Express `Router` configured for a single Arranger catalogue. Returns a `Promise<Router>`.

```ts
import arrangerRouter from '@overture-stack/arranger-graphql-router';

const router = await arrangerRouter(options);
```

#### Options

| Option | Type | Description |
|---|---|---|
| `configs` | `Partial<ConfigsObject>` | Catalogue configuration. See [Configuration](#configuration). |
| `esClient` | `SearchClient` | Optional — bring your own ES/OS client. When omitted, one is created from `configs.esHost`, `configs.esUser`, and `configs.esPass`. |
| `getServerSideFilter` | `GetServerSideFilterFn` | Optional — callback invoked per request to inject a SQON filter for access control. See [Server-side filters](#server-side-filters). |
| `configsSource` | `string` | **Deprecated** — will be removed in v3.2. Pass `configs` directly instead. |

---

## Configuration

`configs` accepts `Partial<ConfigsObject>`, defined in `@overture-stack/arranger-types`. The most commonly used properties are:

### Search engine connection

| Property | Type | Default | Description |
|---|---|---|---|
| `esHost` | `string` | `'http://localhost:9200'` | Elasticsearch or OpenSearch node URL. |
| `esUser` | `string` | `''` | Basic auth username. |
| `esPass` | `string` | `''` | Basic auth password. |
| `searchEngine` | `'elasticsearch' \| 'opensearch'` | auto-detect | Client type. Leave unset to detect from the cluster version API on startup. |

### Catalogue identity

| Property | Type | Description |
|---|---|---|
| `esIndex` | `string` | ES/OS index to query. Required. |
| `documentType` | `string` | GraphQL type name for documents in this catalogue. Required. |

### Feature flags

| Property | Type | Default | Description |
|---|---|---|---|
| `disableDownloads` | `boolean` | `false` | Disable the TSV/file download endpoint. |
| `disableFilters` | `boolean` | `false` | Disable SQON filter support on queries. |
| `disableGraphQLIntrospection` | `boolean` | `false` (`true` when `NODE_ENV=production`) | Disable GraphQL's built-in `__schema`/`__type` introspection system. Recommended in production. **Caveat:** remote nodes used in a [network aggregation](#network-search) deployment must keep this disabled; see that section for details. |
| `disablePlayground` | `boolean` | `false` | Disable the GraphQL Playground UI. |
| `disableSets` | `boolean` | `false` | Disable saved Sets. |

### Table

| Property | Type | Default | Description |
|---|---|---|---|
| `table.maxResultsWindow` | `number` | `10000` | Maximum hits returnable per query (ES/OS default). |
| `table.rowIdFieldName` | `string` | `'id'` | ES field used as the row identifier in table results. |

### Query limits

| Property | Type | Default | Description |
|---|---|---|---|
| `maxAliases` | `number` | unlimited | Maximum aliases per GraphQL query. |
| `maxDepth` | `number` | unlimited | Maximum depth of a GraphQL query. |

---

## Network search

A catalogue can federate aggregation queries across multiple remote Arranger nodes. Add a `network` block to `configs`:

```ts
const router = await arrangerRouter({
  configs: {
    esHost: 'http://localhost:9200',
    esIndex: 'file_centric',
    documentType: 'File',
    network: {
      localNode: {
        displayName: 'Local',
        nodeId: 'local',
      },
      remoteRequests: {
        headers: ['Authorization'],        // forwarded to all remote nodes by default
      },
      remoteNodes: [
        {
          displayName: 'Node A',
          documentType: 'FileAggs',
          graphqlUrl: 'http://node-a:5050/graphql',
          nodeId: 'node-a',
          requests: {
            headers: ['Authorization'],    // per-node override; merged with remoteRequests.headers
          },
        },
        {
          displayName: 'Node B',
          documentType: 'FileAggs',
          graphqlUrl: 'http://node-b:5050/graphql',
          nodeId: 'node-b',
        },
      ],
    },
  },
});
```

When using `apps/search-server`, this config lives in `network.json` inside the catalogue's config directory. A template is at [`apps/search-server/configTemplates/network.json`](../../apps/search-server/configTemplates/network.json).

#### Network config fields

| Field | Description |
|---|---|
| `localNode.displayName` | Human-readable label for this node's results in aggregation responses. |
| `localNode.nodeId` | Stable identifier for this node, used when filtering results by node. |
| `remoteRequests.headers` | Header names to forward from the incoming request to **all** remote nodes. |
| `remoteNodes[].graphqlUrl` | GraphQL endpoint URL of the remote Arranger instance. |
| `remoteNodes[].documentType` | Aggregation type name on the remote node. |
| `remoteNodes[].displayName` | Human-readable label for this remote node's results. |
| `remoteNodes[].nodeId` | Stable identifier for this node, used when filtering results by node. |
| `remoteNodes[].requests.headers` | Header names to forward to this specific node. Takes precedence over `remoteRequests.headers`. |

All nodes must serve overlapping index field names. Fields with the same name and GraphQL type are merged across nodes; fields unique to one node are excluded from federation.

**Introspection requirement:** At startup, each remote node's aggregation field types are discovered via a `__type` GraphQL introspection query. Remote nodes that have `disableGraphQLIntrospection: true` will fail schema discovery and be silently excluded from federation. Do not enable `disableGraphQLIntrospection` on any node that serves as a remote target in a network aggregation deployment. A fix that replaces this with a REST `/introspection/fields` call is tracked in tech-debt and planned for the yoga migration.

---

## Server-side filters

`getServerSideFilter` injects a SQON filter on every query — typically used for access control. The callback receives the request context and returns a `SqonNode` (or `null` for no filter):

```ts
import arrangerRouter from '@overture-stack/arranger-graphql-router';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

const getServerSideFilter: GetServerSideFilterFn = (context) => {
  const userId = context.req.headers['x-user-id'];
  if (!userId) return null;

  return {
    op: 'and',
    content: [
      { op: 'in', content: { field: 'acl', value: [String(userId)] } },
    ],
  };
};

const router = await arrangerRouter({ configs, getServerSideFilter });
```

The returned filter is merged with any SQON the client provides before the query reaches ES/OS. The client cannot remove or bypass it.

In multicatalogue mode the filter is global — it applies to all catalogues mounted under this router instance.

---

## Other exports

### `buildSearchClient(options)`

Creates an Elasticsearch or OpenSearch client:

```ts
import { buildSearchClient } from '@overture-stack/arranger-graphql-router';

const client = await buildSearchClient({
  client: 'elasticsearch',  // 'opensearch', or omit to auto-detect
  node: 'http://localhost:9200',
  username: 'elastic',
  password: 'secret',
});
```

### `resolveCatalogueFields(mapping, extendedFields)`

Transforms a raw ES/OS index mapping into Arranger's field descriptor format. Useful for custom introspection tooling.

### `mergeConfigs(fallback, custom)`

Deep-merges two `ConfigsObject` values, with `custom` taking precedence. Preserves nested objects rather than replacing them — the same merge used internally by `arrangerRouter` when combining defaults with caller-supplied config.

### `SearchClient`, `SupportedClientTypes`

Types for the search client. Import when you need to type a client created externally:

```ts
import type { SearchClient, SupportedClientTypes } from '@overture-stack/arranger-graphql-router';
```

### Sub-path exports

| Import path | Contents |
|---|---|
| `@overture-stack/arranger-graphql-router/utils` | Internal utilities (`ajax`, `runGraphQLQuery`). Not part of the stable API. |
| `@overture-stack/arranger-graphql-router/download` | Download route helpers. Consumed internally by `arrangerRouter`. |
