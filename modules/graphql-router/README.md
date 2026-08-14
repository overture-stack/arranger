# `@overture-stack/arranger-graphql-router`

Core GraphQL routing library for a single Arranger catalogue. Converts an OpenSearch or Elasticsearch index into a working GraphQL API with faceted search, aggregations, SQON filtering, download support, and optional network search federation.

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

### `arrangerRouter(options)`: default export

Creates and returns an Express `Router` configured for a single Arranger catalogue. Returns a `Promise<Router>`.

```ts
import arrangerRouter from '@overture-stack/arranger-graphql-router';

const router = await arrangerRouter(options);
```

#### Options

| Option                | Type                     | Description                                                                                                                         |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `configs`             | `Partial<ConfigsObject>` | Catalogue configuration. See [Configuration](#configuration).                                                                       |
| `esClient`            | `SearchClient`           | Optional: bring your own ES/OS client. When omitted, one is created from `configs.esHost`, `configs.esUser`, and `configs.esPass`.  |
| `getServerSideFilter` | `GetServerSideFilterFn`  | Optional: callback invoked per request to inject a SQON filter for access control. See [Server-side filters](#server-side-filters). |
| `configsSource`       | `string`                 | **Deprecated**: will be removed in v3.2. Pass `configs` directly instead.                                                           |

---

## Configuration

`configs` accepts `Partial<ConfigsObject>`, defined in `@overture-stack/arranger-types`. The most commonly used properties are:

### Search engine connection

| Property       | Type                              | Default                   | Description                                                                 |
| -------------- | --------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `esHost`       | `string`                          | `'http://localhost:9200'` | OpenSearch or Elasticsearch node URL.                                       |
| `esUser`       | `string`                          | `''`                      | Basic auth username.                                                        |
| `esPass`       | `string`                          | `''`                      | Basic auth password.                                                        |
| `searchEngine` | `'opensearch' \| 'elasticsearch'` | auto-detect               | Client type. Leave unset to detect from the cluster version API on startup. |

### Catalogue identity

| Property       | Type     | Description                                                  |
| -------------- | -------- | ------------------------------------------------------------ |
| `esIndex`      | `string` | ES/OS index to query. Required.                              |
| `documentType` | `string` | GraphQL type name for documents in this catalogue. Required. |

### Feature flags

| Property                      | Type      | Default                                     | Description                                                                                                                                                                                                                                                                                              |
| ----------------------------- | --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disableDownloads`            | `boolean` | `false`                                     | Disable the TSV/file download endpoint.                                                                                                                                                                                                                                                                  |
| `disableFilters`              | `boolean` | `false`                                     | Disable SQON filter support on queries.                                                                                                                                                                                                                                                                  |
| `disableGraphQLIntrospection` | `boolean` | `false` (`true` when `NODE_ENV=production`) | Disable GraphQL's built-in `__schema`/`__type` introspection system. Recommended in production. **Caveat:** remote nodes used in a [network aggregation](#network-search) deployment must keep this disabled; see that section for details.                                                              |
| `disablePlayground`           | `boolean` | `false`                                     | Disable the GraphQL Playground UI.                                                                                                                                                                                                                                                                       |
| `enableGraphQLBatching`       | `boolean` | `false`                                     | Enable array-based GraphQL query batching (sending multiple operations in a single HTTP request). Disabled by default: unrestricted batching can be used to bypass request-level rate limiting and amplify the cost of a single request. Only enable if a consumer genuinely relies on batched requests. |
| `enableSets`                  | `boolean` | `false`                                     | Enable saved Sets. Sets are disabled by default; set to `true` to activate.                                                                                                                                                                                                                              |

### Table

| Property                 | Type     | Default | Description                                           |
| ------------------------ | -------- | ------- | ----------------------------------------------------- |
| `table.maxResultsWindow` | `number` | `10000` | Maximum hits returnable per query (ES/OS default).    |
| `table.rowIdFieldName`   | `string` | `'id'`  | ES field used as the row identifier in table results. |

### Query limits

| Property     | Type     | Default   | Description                        |
| ------------ | -------- | --------- | ---------------------------------- |
| `maxAliases` | `number` | unlimited | Maximum aliases per GraphQL query. |
| `maxDepth`   | `number` | unlimited | Maximum depth of a GraphQL query.  |

---

## Network search

A catalogue can federate aggregation queries across multiple remote Arranger nodes. Add a `network` block to `configs`:

```ts
const router = await arrangerRouter({
	configs: {
		documentType: 'file',
		esHost: 'http://localhost:9200',
		esIndex: 'file_centric',
		network: {
			// Runs once per node per query. Use it to forward auth to remote nodes.
			customizeRemoteRequest: ({ context, remoteNode }) => ({
				headers: {
					Authorization: context.request.headers.get('Authorization') ?? '',
				},
			}),
			localNode: {
				displayName: 'Local',
				nodeId: 'local',
			},
			remoteNodes: [
				{
					displayName: 'Node A',
					documentType: 'file', // the remote's root field; `Aggregations` is appended internally
					graphqlUrl: 'http://node-a:5050/graphql',
					nodeId: 'node-a',
				},
				{
					displayName: 'Node B',
					documentType: 'file',
					graphqlUrl: 'http://node-b:5050/graphql',
					nodeId: 'node-b',
				},
			],
		},
	},
});
```

#### Network config fields

| Field                        | Description                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customizeRemoteRequest`     | Callback invoked once per node per query, receiving `{ context, remoteNode }` and returning request properties (currently `headers`) to add to that node's outgoing request.                        |
| `localNode.displayName`      | Human-readable label for this node's results in aggregation responses. Omit the whole `localNode` block to federate over remote nodes only.                                                        |
| `localNode.nodeId`           | Stable identifier for this node, used by the `nodesFilter` query argument.                                                                                                                          |
| `remoteNodes[].displayName`  | Human-readable label for this remote node's results. Also used to match responses back to nodes, so keep it unique across the network.                                                             |
| `remoteNodes[].documentType` | The remote catalogue's `documentType`, meaning its root GraphQL field (e.g. `file`). `Aggregations` is appended to this value during field discovery, so give the bare document type, not `fileAggregations`. |
| `remoteNodes[].graphqlUrl`   | GraphQL endpoint URL of the remote Arranger instance.                                                                                                                                              |
| `remoteNodes[].nodeId`       | Stable identifier for this node, used by the `nodesFilter` query argument.                                                                                                                          |

#### With `apps/search-server`

When running `apps/search-server`, this config lives in `network.json` inside the catalogue's config directory. A template is at [`apps/search-server/configTemplates/network.json`](../../apps/search-server/configTemplates/network.json).

A JSON file cannot express a callback, so `search-server` accepts two extra declarative properties **that this library does not**, and normalizes them into a `customizeRemoteRequest` function before calling `arrangerRouter`:

| Field (`search-server` only)      | Description                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `remoteRequests.headers`          | Header names to copy from the incoming request onto the outgoing request to **every** remote node.                |
| `remoteNodes[].requests.headers`  | Header names to forward to this specific node. **Replaces** `remoteRequests.headers` for that node, rather than merging with it. |

Passing either of these to `arrangerRouter` directly has no effect: at this layer, supply `customizeRemoteRequest` instead.

#### Field merging

Nodes do **not** need identical field sets. The federated schema is the **union** of the supported aggregation fields found across all nodes, deduplicated by field name and type. A field present on only one node still appears in the schema, and each node is only queried for the fields it actually has.

When a node lacks a requested field, it contributes one sentinel bucket carrying its total hits for that query, so counts still add up:

```json
{ "key": "___aggregation_not_available___", "doc_count": 4210 }
```

Merging is keyed on field name and aggregation type, so nodes only combine on a field when both name it identically. Only the `Aggregations` type federates; `NumericAggregations` fields are excluded from the federated schema entirely.

**Introspection requirement:** At startup, each remote node's aggregation field types are discovered via a `__type` GraphQL introspection query. A remote node with `disableGraphQLIntrospection: true` fails schema discovery and is reported as an errored node with zero hits for the lifetime of this server's process. Since the flag defaults to `true` when `NODE_ENV=production`, any node serving as a remote target must explicitly set it to `false`. A fix that replaces this with a REST `/introspection/fields` call is tracked in tech-debt and planned for the yoga migration.

For the query shape, per-node status reporting, failure behaviour, and full limitations, see the [Federated search](https://github.com/overture-stack/arranger/blob/main/docs/federated-search.md) documentation.

---

## Server-side filters

`getServerSideFilter` injects a SQON filter on every query: typically used for access control. The callback receives the request context and returns a `SqonNode` (or `null` for no filter):

```ts
import arrangerRouter from '@overture-stack/arranger-graphql-router';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

const getServerSideFilter: GetServerSideFilterFn = (context) => {
	const userId = context.req.headers['x-user-id'];
	if (!userId) return null;

	return {
		op: 'and',
		content: [{ op: 'in', content: { field: 'acl', value: [String(userId)] } }],
	};
};

const router = await arrangerRouter({ configs, getServerSideFilter });
```

The returned filter is merged with any SQON the client provides before the query reaches ES/OS. The client cannot remove or bypass it.

In multicatalogue mode the filter is global: it applies to all catalogues mounted under this router instance.

---

## Other exports

### `buildSearchClient(options)`

Creates an OpenSearch or Elasticsearch client:

```ts
import { buildSearchClient } from '@overture-stack/arranger-graphql-router';

const client = await buildSearchClient({
	client: 'opensearch', // 'elasticsearch', or omit to auto-detect
	node: 'http://localhost:9200',
	username: 'elastic',
	password: 'secret',
});
```

### `resolveCatalogueFields(mapping, extendedFields)`

Transforms a raw ES/OS index mapping into Arranger's field descriptor format. Useful for custom introspection tooling.

### `mergeConfigs(fallback, custom)`

Deep-merges two `ConfigsObject` values, with `custom` taking precedence. Preserves nested objects rather than replacing them: the same merge used internally by `arrangerRouter` when combining defaults with caller-supplied config.

### `SearchClient`, `SupportedClientTypes`

Types for the search client. Import when you need to type a client created externally:

```ts
import type { SearchClient, SupportedClientTypes } from '@overture-stack/arranger-graphql-router';
```

### Sub-path exports

| Import path                                        | Contents                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `@overture-stack/arranger-graphql-router/utils`    | Internal utilities (`ajax`, `runGraphQLQuery`). Not part of the stable API. |
| `@overture-stack/arranger-graphql-router/download` | Download route helpers. Consumed internally by `arrangerRouter`.            |
