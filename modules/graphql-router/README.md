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
| `getServerSideFilter` | `GetServerSideFilterFn`  | Optional: the synchronous callback returning the filter each read is limited to, for access control. Leave it out for no access control. See [Server-side filters](#server-side-filters). |
| `configsSource`       | `string`                 | **Deprecated**, not read: pass `configs` instead. Passed with no `configs`, construction rejects; beside them, it is ignored with a warning. |

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
| `disableDownloads`            | `boolean` | `false`                                     | Disable the router's `/download` route, which then answers `404` for every method and path beneath it. An integration's own export route applies the flag itself; see [Export routes](#export-routes).                                                                                                    |
| `disableFilters`              | `boolean` | `false`                                     | Drop the client's filter. A request whose GraphQL variables carry `filters` or `sqon` is refused with `400`, which for a POST needs its JSON body parsed before the router. Any client filter that still arrives, written inline in the query or sent as an export's `sqon`, is left out of the search query and of every facet, a bucket's `filter_by_term` included, and a saved set records none. The server-side filter still applies. |
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
| `maxAliases` | `number` | `15`      | Maximum aliases per GraphQL query. |
| `maxDepth`   | `number` | `7`       | Maximum depth of a GraphQL query.  |

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

`getServerSideFilter` is how a deployment applies access control. The router calls it on every read, whether a record query, an aggregation, saving a set, a network search or an export, and limits that read to the filter it returns.

### A deployment with no access control passes nothing

Leave `getServerSideFilter` out of `arrangerRouter`'s options. The router then applies `includeEverything`, the filter that keeps every document, records that it chose it because nothing was passed, and logs `access control: none (defaulted)` at startup.

Every read still carries a filter, because the code has to tell two situations apart that would otherwise look identical:

| Situation | What the read receives | Outcome |
| --- | --- | --- |
| The deployment decided nothing is restricted | `includeEverything`'s filter, recorded by the router | Every document is served |
| Code forgot to pass the restriction | No filter | The read is refused |

So a deployment with no access control writes nothing, and a read path that loses the filter fails loudly instead of serving everything.

### Where `includeEverything` is written

| Where | When |
| --- | --- |
| Returned from a callback: `return includeEverything(context);` | The callback allows this request without restricting it |
| Passed to the router: `getServerSideFilter: includeEverything` | Optionally, to state that the deployment applies no access control. The startup log then reads `access control: none (explicit)` |
| Passed to `getAllData` or `dataStream` as `getServerSideFilter` | In code that builds its own context without the router, for a deployment with no access control. See [Export routes](#export-routes) |

`getDefaultServerSideFilter` is a deprecated alias for `includeEverything`, the same function. Both take the request context, so call them with it, or pass the function itself.

### Writing a callback

**The callback must be synchronous, and must return a filter for every request it receives, including unauthenticated ones.** There is no "no filter" return value: an absent filter, or one holding an empty combination, an `all` with no values, a range with no bound, an exclusion with no value list, a clause naming no field or an entry that is not a SQON node anywhere, such as a hole in a list, would match broadly, so it is refused rather than applied. Each intent has its own value:

| Intent | Return |
| --- | --- |
| This request may see everything | `includeEverything(context)` |
| This request may see nothing | an `in` clause with an empty `value` list |
| This request may see some documents | a filter selecting those documents |

```ts
import arrangerRouter, { type ArrangerBaseContext, includeEverything } from '@overture-stack/arranger-graphql-router';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

type AppContext = ArrangerBaseContext & { user?: { id: string; isAdministrator: boolean } };

const getServerSideFilter: GetServerSideFilterFn<AppContext> = (context) => {
	const { user } = context;

	if (user?.isAdministrator) {
		return includeEverything(context);
	}

	return {
		content: { fieldName: 'acl', value: user ? [user.id] : [] },
		op: 'in',
	};
};

const router = await arrangerRouter({ configs, getServerSideFilter });
```

Note `fieldName`, not `field`. A content clause using any other key does not describe a field, so the router refuses the filter rather than apply a clause that restricts nothing.

`user` stands for whatever the deployment's own authentication established. Set it on `res.locals` in middleware mounted before the router, and the callback reads it on every read path: it receives the application's own `res.locals` keys beneath the router's, which sit under `res.locals.arranger`, so a key the router or `graphqlOptions.context` also sets takes their value. `req.context` is a deprecated view of `res.locals.arranger`; see the [migration guide](../../docs/reference/08-Migration/v3.1.md#per-request-state-res-locals).

The router rejects at construction a `getServerSideFilter` that is neither left out nor a non-async function, `null` included, naming what it received. A callback that throws, returns a promise, or returns no usable filter fails that request with an `AccessControlError`. A GraphQL client then receives the fixed text "The server could not apply its access control because of a problem in its configuration, not in this request.", while the full message and its cause are logged on the server under `access_control.evaluation_failed`.

### How the filter applies

The returned filter is composed with any SQON the client provides, and the client cannot remove or weaken it: composition happens after the client's filter is parsed, and a filter is required to survive to the query. It is applied to record, aggregation, set, network search and export queries.

Aggregations are worth one note, because they are the case where "the filter is applied" is easy to assume and hard to see. A facet does not apply the caller's own filter on the field it is aggregating, so that selecting a value does not collapse that facet to the single value chosen. That exemption is for the caller's filter only; the server-side filter is re-applied to every aggregation, including one on the same field it restricts. So a facet on an access-controlled field shows only the values that caller may see.

In multicatalogue mode the filter is global: it applies to all catalogues mounted under this router instance.

---

## Export routes

The router serves exports at `POST /download`. An integration building its own export route uses the same two functions, which are public API:

| Function | Import | Resolves to |
| --- | --- | --- |
| `getAllData` | `utils.getAllData` from the package root, or `getAllData` from `@overture-stack/arranger-graphql-router/utils` | A stream of `{ hits, total }` chunks, one per search page |
| `dataStream` | `@overture-stack/arranger-graphql-router/download` | `{ contentType, output, responseFileName }`, where `output` streams TSV rows, header row first, or JSON lines |

### Input is validated by the functions themselves

`dataStream` checks `params`, and `getAllData` checks its `chunkSize`, `sort` and `sqon`, so an integration can hand `dataStream` the client's object whole. A broken rule rejects the call with an `InvalidExportRequestError` before any output:

- `params.files` holds exactly one file object: this version exports one file per request.
- The file's fields are read by name, `sqon`, `columns`, `sort`, `fileName`, `fileType`, `maxRows`, `chunkSize`, `uniqueBy` and `valueWhenEmpty`. Anything else in the file, or at the top level of `params`, is ignored and never used.
- `chunkSize` is a positive integer and `maxRows` a non-negative integer, both as JSON numbers. `fileType` is `tsv` or `json`, where absent, `null` or empty names none, and `tsv` applies when nothing names one. `columns` is a non-empty array of column objects. `fileName` is a well-formed string, and `uniqueBy` and `valueWhenEmpty` are strings. A top-level `chunkSize`, `fileName` or `fileType` follows the same rule, and applies where the file names none.
- `sort`, for `dataStream` and `getAllData` alike, is an array of entries, each naming a non-empty `fieldName` and an `order` of `asc` or `desc`, in any case. Empty or absent keeps the default order, and an `_id` tiebreaker always follows.
- A `sqon` that cannot be compiled into a query is refused, naming the SQON rule it broke where there is one.
- A `maxRows` applies only when the catalogue allows custom row limits, and `0` asks for the configured limit. A configured limit that is unset or `0` exports every row.
- An export the row limit cuts short is marked without changing the file: `getAllData`'s chunks carry `matchingTotal`, how many documents the filter matches, and `truncated`, beside `hits` and `total`, which is capped at the limit, and `dataStream` returns `exportTotals()`, giving the same once the first row is formatted. The router's `/download` sends them as the `Arranger-Export-Truncated` and `Arranger-Export-Matching-Total` headers.

### The filter comes from the router

Mount the router at the application's root and the export route after it, so every request has passed through the router's middleware, and pass the request's state as `ctx: res.locals`. The export then applies the filter the router recorded:

| Context | `getServerSideFilter` left out | `getServerSideFilter` passed |
| --- | --- | --- |
| Built by the router | The router's filter | The router's filter and the caller's together, so a caller can only narrow it |
| Built some other way | Refused, before any output | The caller's filter |

On a context built some other way, pass the filter function this deployment's router is configured with, or `includeEverything` if the deployment applies no access control. Each callback is evaluated once per export, under the same rules as the router's.

### Errors

| Error | Means | Answer |
| --- | --- | --- |
| `InvalidExportRequestError`, from `./download` | The request broke a rule. Its message names the rule broken where there is one, and never a value the request carried, so it is written for the client | `400`, with the error's message |
| `AccessControlError`, from the package root | The deployment's access control could not be applied to the request | `500`, with a fixed text saying the problem is in the server's configuration, not in the request |
| Anything else | A server fault, such as a failed search | `500`, with a fixed text saying the problem is on the server, not in the request |

Answer each as plain text, and log the error itself on the server. Only an `InvalidExportRequestError`'s message is written for the client; any other error's message, and every error's cause, is written for the log.

### Joining the output to the response

Join `output` to the response with `stream.pipeline`, which aborts the response when the export fails partway and stops the export when the client disconnects. `output` emits `'error'` on any failure after the call resolves.

The package declares `res.locals.arranger` on Express's `Locals`, so a TypeScript version of this example needs no declarations of its own. An export route still passing the deprecated `ctx: req.context` keeps working where no access control is configured; with access control, the callback then sees no key recorded at the root of `res.locals` and treats the export as a request carrying no identity, by its own rule; pass `res.locals`.

```js
import { pipeline } from 'node:stream';

import arrangerRouter, { ACCESS_CONTROL_FAILURE_MESSAGE } from '@overture-stack/arranger-graphql-router';
import { dataStream, InvalidExportRequestError } from '@overture-stack/arranger-graphql-router/download';
import express from 'express';

const app = express();

app.use(await arrangerRouter({ configs }));

// The rule broken for an invalid request, written for the client; fixed text for anything else.
const failureText = (error) => {
	if (error instanceof InvalidExportRequestError) {
		return error.message;
	}

	return error?.name === 'AccessControlError'
		? ACCESS_CONTROL_FAILURE_MESSAGE
		: 'The export failed because of a problem on the server, not in the request.';
};

app.post('/export', express.json(), async (req, res) => {
	try {
		const { contentType, output, responseFileName } = await dataStream({ ctx: res.locals, params: req.body });

		res.attachment(responseFileName).set('Content-Type', contentType);
		pipeline(output, res, (error) => {
			if (error) {
				console.error('export.stream_failed', error);
			}
		});
	} catch (error) {
		console.error('export.failed', error);
		res
			.status(error instanceof InvalidExportRequestError ? 400 : 500)
			.type('text/plain')
			.set('X-Content-Type-Options', 'nosniff')
			.send(failureText(error));
	}
});
```

The router's own `/download` goes further: it holds its response headers until the first row is formatted, so a failure on the first search, or on formatting the first row, still answers with an error status.

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

### `includeEverything`, `getDefaultServerSideFilter`

The filter callback that keeps every document, and its deprecated alias. See [Server-side filters](#server-side-filters).

### `AccessControlError`

What a read fails with when access control cannot be evaluated for it. See [Export routes](#export-routes).

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
| `@overture-stack/arranger-graphql-router/utils`    | `getAllData`, public API for an integration's own export route; see [Export routes](#export-routes). The other utilities, such as `ajax` and `runGraphQLQuery`, are internal and not part of the stable API. |
| `@overture-stack/arranger-graphql-router/download` | `dataStream` and `InvalidExportRequestError`, public API for an integration's own export route; see [Export routes](#export-routes). The default export is the router's own `/download` routes. |
