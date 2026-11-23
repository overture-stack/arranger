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
| `getServerSideFilter` | `GetServerSideFilterFn`  | Optional: the synchronous callback returning the filter that limits each read, for access control. Leave it out for no access control. See [Server-side filters](#server-side-filters). |
| `getRequester` | `(context) => RequesterAnswer` | Optional: who made a request, read from the same context as `getServerSideFilter` and stated explicitly: `{ kind: 'principal', id }`, `{ kind: 'anonymous' }` or `{ kind: 'suspended', retryAfterSeconds?, id? }`. Given, it makes saved sets belong to whoever saved them. See [Server-side filters](#server-side-filters). |
| `getArtifactCreateFilter` | `GetServerSideFilterFn` | Optional: a synchronous callback of `getServerSideFilter`'s shape, returning the records a requester may create an artifact from, such as a saved set. Given, `saveSet` refuses a set holding any record outside it. Leave it out for no such check. See [Server-side filters](#server-side-filters). |
| `onIndexMapping` | `(mappingFromIndex, indexProbe) => void` | Optional: called once, before the router resolves, with a copy of the index mapping the router fetched and an `IndexProbe` of the catalogue's index, so a host can check fields against the mapping and ask the index what the mapping cannot answer. A throw fails the router's construction. |
| `configsSource`       | `string`                 | **Deprecated**, not read: pass `configs` instead. Passed with no `configs`, construction rejects; beside them, it is ignored with a warning. |

The `IndexProbe`, exported as a type from the package root, compiles a condition as the router compiles its server-side filter, so each answer holds for the queries the router will send, and stays usable after the hook returns:

- `countMatching(condition)`: how many records a condition matches.
- `countRecordsAndValues(fieldName)`: how many records hold a field, and how many values they hold in it; more values than records means some record holds several.
- `validate(condition)`: whether the engine accepts a condition's query, with the engine's explanation when it does not.

Each count rejects unless every shard answered in time and the total is exact.

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

Leave `getServerSideFilter` out of `arrangerRouter`'s options. The router then applies `includeEverything`, the filter that keeps every document, records that it chose it because nothing was passed, and logs `server-side filter: none (defaulted)` at startup.

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
| Passed to the router: `getServerSideFilter: includeEverything` | Optionally, to state that the deployment applies no access control. The startup log then reads `server-side filter: none (explicit)` |
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

**The callback also learns which read it serves, and gets the request's own store.** Its second argument is `{ readPath }`, one of `hits`, `aggregations`, `sets` for saving a set, `export` and `network`, so one callback can answer each read differently; a callback taking one argument ignores it. `context.locals` is the request's own `res.locals`, the same object rather than a copy, so a member attached by an earlier middleware and hidden from copies stays readable there. Neither an application's `res.locals` keys nor `graphqlOptions.context` can replace it, and an export route passing `ctx: res.locals` gives the callback the same.

The router rejects at construction a `getServerSideFilter` that is neither left out nor a non-async function, `null` included, naming what it received. A callback that throws, returns a promise, or returns no usable filter fails that request with an `AccessControlError`. A GraphQL client then receives the fixed text "The server could not apply its access control because of a problem in its configuration, not in this request.", while the full message and its cause are logged on the server under `access_enforcement.evaluation_failed`.

**A callback may refuse a request for now** by throwing an `AccessControlUnavailableError`, from the package root, given a message for the server log and its `retryAfterSeconds`. A GraphQL client then receives the router's fixed text, `ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE`, with `extensions.code` `ACCESS_ENFORCEMENT_UNAVAILABLE`, and no data for the field, at the status of any execution error; the router's `/download` answers `503` with that text and `Retry-After`. Each logs the thrower's message as `access_enforcement.unavailable_answered`, and nothing as `access_enforcement.evaluation_failed`, since nothing is misconfigured.

**A callback may deny the request its catalogue** by throwing an `AccessControlDeniedError`, from the package root, given the catalogue and the kind of denial: `no-access`, the person has no access to it; `access-too-broad`, their access is more than the catalogue's filter can express; or `misconfigured`, access control is configured wrongly for it; and, for `getArtifactCreateFilter` alone, `no-artifact-create`, the person may not save a set from some of the records selected. The catalogue's index is then never searched for that read. The router answers on every read path with its own fixed text for the kind, naming the catalogue, and nothing else the thrower says: a GraphQL client receives `extensions.code` `ACCESS_ENFORCEMENT_DENIED` for `no-access` and `no-artifact-create`, and `INTERNAL_SERVER_ERROR` for the other two, and `/download` answers `403` and `500` the same way. Each answer is logged as `access_enforcement.denial_answered` with the catalogue and the kind, at info for `no-access` and `no-artifact-create` and at error otherwise, since only the other two leave the operator something to fix. A filter matching nothing is still the way to withhold records without saying so.

**`getArtifactCreateFilter` decides which records may be saved as a set.** Given, `saveSet` calls it with `{ readPath: 'sets' }` beside `getServerSideFilter` and holds the set to it whole. It selects the records as it would without it, then checks against the filter every record the set will hold when read, a record sharing a saved value included, within what the requester may view. Where any lies outside, nothing is saved and the request is refused with an `AccessControlDeniedError` of kind `no-artifact-create`: a set is never saved with only the records inside. Returning `includeEverything(context)` saves every selection with no further search, as leaving the callback out does. A callback throwing a denial refuses the save even where the selection matches no records. A check the search engine cannot answer exactly refuses the save as a problem on the server, logged as `sets.artifact_create_check_failed`, and so does a set whose path lies inside a nested field. The router refuses to start when `getArtifactCreateFilter` is given but is not a synchronous function.

**`getRequester` gives saved sets owners.** Give the router `getRequester(context)`, which reads the same context as the callback and states who made the request, as one of:

| Answer | Meaning |
| --- | --- |
| `{ kind: 'principal', id }` | A principal, a person or a service account, identified by a non-empty `id` |
| `{ kind: 'anonymous' }` | A request presenting no credential |
| `{ kind: 'suspended', retryAfterSeconds?, id? }` | A principal signed in but not confirmed right now. Its `id`, where given, never makes it an owner |

Any other answer, a bare string or `undefined` included, refuses the request as a configuration failure, as a throwing callback does: no state is read from a missing value.

Each saved set records how it was saved, as its `attribution`:

| `attribution` | Saved | `userId` stores |
| --- | --- | --- |
| `principal` | by a principal, under `getRequester` | the principal's `id`, whatever `userId` the client sends |
| `anonymous` | by an anonymous request, under `getRequester` | nothing |
| `unattributed` | by a router given no `getRequester` | the `userId` the client sends, as data, never as an owner |

A suspended principal's `saveSet` is refused before anything is read or stored, answered with `extensions.code` `ACCESS_ENFORCEMENT_UNAVAILABLE`, to retry after `retryAfterSeconds`. A set carrying no `attribution` was saved before marks were recorded, and is read as `unattributed`.

With `getRequester`, the sets connection lists a principal its own sets, and every reader the `unattributed` sets and those carrying no mark. An `anonymous` set is listed to no one, and reached only when the client's filter names it by `setId`, in an `in` at the top of the filter or directly inside a top-level `and`. A principal's set is reached by that principal alone, by `setId` or any other way. A suspended principal reads as an anonymous request. The sets aggregations count the same sets. A filter naming a saved set (a `set_id:` value) on hits, aggregations or an export, in `saveSet`'s own filter or in the sets connection's narrowing, resolves the set by the same rule: one the reader may not use matches exactly as an id that does not exist, so the two cannot be told apart. A set's `sqon` goes to the principal that saved it, and to every reader for a set with no owner.

**Under a filter callback, a set's records pass through each reader's filter**, with or without `getRequester`: a set's `ids` and `size` are checked against the reader's filter on the set's catalogue, and where the set holds records the reader may not see, they hold only the ones the reader may, with nothing to say what was left out. A set whose `type` is none of the router's catalogues has no `ids` and no `size`. A page of the sets connection holds at most 20 sets, the rest reachable by `offset`.

Without `getRequester`, saved sets have no owners, as in 3.0.x: every set is listed to everyone with its filter, and `saveSet` stores the `userId` the client sends, marking the set `unattributed`. Given a filter callback beside none, the router logs `sets.unowned` at info when it starts. Pass `getRequester` wherever the filter depends on who is asking.

**No reader is given a set's `userId`**, in any deployment: the sets connection and `saveSet` answer it as `null`, the field kept in the schema so a client selecting it keeps working. It is stored, as the client sends it or as the principal's `id`, and read only by the listing that finds a principal's own sets and by operators querying the sets index directly. More generally, a field given to some readers other than as stored is never a filter or sort key, and its aggregation answers `null`: `userId` always, `ids` and `size` under a filter callback, and `sqon` under `getRequester`. A filter or sort on the sets connection may name only a field that is indexed and given to every reader as stored, or a path within one. `sqon` never qualifies, since the sets index stores it without indexing it. Any other field, a pattern included, is refused with `extensions.code` `BAD_USER_INPUT`, its message naming the fields it may use.

**The sets index records the mark as a keyword.** A sets index the router creates maps `attribution` as one. On an existing sets index lacking it, the router adds it when it starts, which needs no reindex; where that cannot be done, or `attribution` is mapped as anything else, it warns `sets.index_mapping_outdated`. Each save reads the mapping again, since an index can be recreated after startup. Where it does not map `attribution` as a keyword, a set saved without `getRequester` is stored unmarked, which is read as the same `unattributed`, and nothing is written into the field it lacks, so a strict mapping accepts it; under `getRequester`, `saveSet` is refused as a configuration failure and stores nothing, since an unmarked set would be read as unattributed.


### How the filter applies

The returned filter is composed with any client-provided SQON, and the client cannot remove or weaken it: composition happens after the client's filter is parsed, and a filter is required to survive to the query. It is applied to record, aggregation, set, network search and export queries.

Aggregations are worth one note, because they are the case where "the filter is applied" is easy to assume and hard to see. A facet does not apply the caller's own filter on the field it is aggregating, so that selecting a value does not collapse that facet to the single value chosen. That exemption is for the caller's filter only; the server-side filter applies whole to every aggregation, including one on the same field it restricts. So a facet on an access-controlled field shows only the values visible to that caller.

In multicatalogue mode the filter is global: it applies to all catalogues mounted under this router instance.

Where the filter restricts any record, each search of record queries, aggregations, saved sets and exports sends `allow_partial_search_results: false`, so a shard refusing the search fails the whole read. A filter that is `includeEverything`'s, alone or as every member of an `and`, restricts no record, and its searches leave partial results to the engine.

The search engine limits how many clauses a query may hold. Where it refuses a read past that limit and the filter restricts any record, the read fails with an `AccessControlQueryTooLargeError`, whose message names the catalogue, and the server logs `access_enforcement.query_too_large` with the catalogue, the read path and the engine's limit. Where the filter restricts none, the refusal is the request's own mistake, answered with the rule its filter broke: "The filter must compile to no more clauses than the search engine accepts." See [GraphQL errors](#graphql-errors) and [Export routes](#export-routes) for how each is answered.

---

## GraphQL errors

Each GraphQL error carries its `message`, its `locations` and `path` where it has them, and `extensions.code`, nothing more, debug mode included. Its detail, such as a stack or a search engine's report, is logged on the server.

| Cause | `extensions.code` | `message` | Logged on the server as |
| --- | --- | --- | --- |
| The request's own mistake, such as a syntax or validation error, a variable of the wrong type, or batched operations the endpoint refuses | Apollo's own code, such as `GRAPHQL_PARSE_FAILED`, `GRAPHQL_VALIDATION_FAILED` or `BAD_USER_INPUT`, and `INTERNAL_SERVER_ERROR` for the few Apollo raises with no code of their own, such as refused batching | The error's own message, less any field-name suggestion | `graphql.invalid_request`, at info |
| A filter breaking one of the router's rules, a SQON rule or the clause-limit rule above | `BAD_USER_INPUT` | The rule it broke | `graphql.invalid_request`, at info, with the rule's detail as its cause |
| Access control cannot be evaluated, an `AccessControlError` | The error's own code, `INTERNAL_SERVER_ERROR` unless it carries another | "The server could not apply its access control because of a problem in its configuration, not in this request." | `access_enforcement.evaluation_failed` |
| The search engine refused the read past its clause limit once the catalogue's access filter was applied, an `AccessControlQueryTooLargeError` | `ACCESS_ENFORCEMENT_QUERY_TOO_LARGE` | The error's own message, naming the catalogue | `access_enforcement.query_too_large` |
| Anything else, a search engine's failure included | The error's own code, `INTERNAL_SERVER_ERROR` unless it carries another | "The request failed because of a problem on the server, not in the request." | `graphql.failed`, with the whole error and the catalogue |

Network search answers each node's failures by the same rules, in that node's `errors`, logging a local node's server problem as `network.node_failed` and a filter's broken rule as `network.invalid_request`. A remote node's failure is answered with fixed text for its kind, and its URL, its own messages and the request's headers stay out of the answer:

| A remote node | Its `errors` |
| --- | --- |
| Could not be reached | "This node could not be reached." |
| Answered with an error status | "This node answered the request with errors." |
| Took longer than the request allows, or the request was cancelled | "The request to this node was cancelled before it answered." |
| Answered with data this server cannot read | "This node answered with data this server cannot read." |

The server logs each as `network.node_failed`, with the node's name, its URL, the kind of failure and the node's own messages, and never the request's headers.

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
- An export cut short by the row limit is marked without changing the file: `getAllData`'s chunks carry `matchingTotal`, how many documents match the filter, and `truncated`, beside `hits` and `total`, which is capped at the limit, and `dataStream` returns `exportTotals()`, giving the same once the first row is formatted. The router's `/download` sends them as the `Arranger-Export-Truncated` and `Arranger-Export-Matching-Total` headers.

### The filter comes from the router

Mount the router at the application's root and the export route after it, so every request has passed through the router's middleware, and pass the request's state as `ctx: res.locals`. The export then applies the router's recorded filter:

| Context | `getServerSideFilter` left out | `getServerSideFilter` passed |
| --- | --- | --- |
| Built by the router | The router's filter | The router's filter and the caller's together, so a caller can only narrow it |
| Built some other way | Refused, before any output | The caller's filter |

On a context built some other way, pass the filter function this deployment's router is configured with, or `includeEverything` if the deployment applies no access control. Each callback is evaluated once per export, under the same rules as the router's.

### Errors

| Error | Means | Answer |
| --- | --- | --- |
| `InvalidExportRequestError`, from `./download` | The request broke a rule, the clause-limit rule included where no server-side filter restricts any record. Its message names the rule broken where there is one, and never a value carried by the request, so it is written for the client | `400`, with the error's message |
| `AccessControlDeniedError`, from the package root | The callback denied the request its catalogue. Its message is the router's fixed text for its kind, naming the catalogue, so it is written for the client | `403` for `no-access` and `no-artifact-create`, `500` for `access-too-broad` and `misconfigured`, with the error's message |
| `AccessControlUnavailableError`, from the package root | The callback refused to serve the request for now. Its message is for the server log | `503`, with `ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE`, and `Retry-After` set to its `retryAfterSeconds` |
| `AccessControlError`, from the package root | The deployment's access control could not be applied to the request | `500`, with a fixed text saying the problem is in the server's configuration, not in the request |
| `AccessControlQueryTooLargeError`, from the package root | The search engine refused the export's search past its clause limit once the catalogue's access filter was applied. Its message is fixed text naming the catalogue, so it is written for the client | `500`, with the error's message |
| Anything else | A server fault, such as a failed search | `500`, with a fixed text saying the problem is on the server, not in the request |

Answer each as plain text, and log the error itself on the server. Only an `InvalidExportRequestError`'s, an `AccessControlDeniedError`'s or an `AccessControlQueryTooLargeError`'s message is written for the client, and an `AccessControlUnavailableError` is answered with `ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE`; any other error's message, and every error's cause, is written for the log.

### Joining the output to the response

Join `output` to the response with `stream.pipeline`, which aborts the response when the export fails partway and stops the export when the client disconnects. `output` emits `'error'` on any failure after the call resolves: an export ends with its error when a row cannot be formatted, in JSON as in TSV. A client leaving ends the pipeline with an `ERR_STREAM_PREMATURE_CLOSE` error, which is no fault of the server's. A search failing after the client has left reaches no reader, so `getAllData` logs it as `download.stream_failed`.

The package declares `res.locals.arranger` on Express's `Locals`, so a TypeScript version of this example needs no declarations of its own. An export route still passing the deprecated `ctx: req.context` keeps working where no access control is configured; with access control, the callback then sees no key recorded at the root of `res.locals` and treats the export as a request carrying no identity, by its own rule; pass `res.locals`.

```js
import { pipeline } from 'node:stream';

import arrangerRouter, {
	ACCESS_CONTROL_FAILURE_MESSAGE,
	ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE,
} from '@overture-stack/arranger-graphql-router';
import { dataStream, InvalidExportRequestError } from '@overture-stack/arranger-graphql-router/download';
import express from 'express';

const app = express();

app.use(await arrangerRouter({ configs }));

// The rule broken for an invalid request, and the refusal of a search past the engine's clause limit, both
// written for the client; fixed text for anything else.
const failureText = (error) => {
	if (error instanceof InvalidExportRequestError || error?.name === 'AccessControlQueryTooLargeError') {
		return error.message;
	}

	if (error?.name === 'AccessControlUnavailableError') {
		return ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE;
	}

	return error?.name === 'AccessControlError'
		? ACCESS_CONTROL_FAILURE_MESSAGE
		: 'The export failed because of a problem on the server, not in the request.';
};

app.post('/export', express.json(), async (req, res) => {
	try {
		const { contentType, output, responseFileName } = await dataStream({ ctx: res.locals, params: req.body });

		res.attachment(responseFileName).set('Content-Type', contentType).set('X-Content-Type-Options', 'nosniff');
		pipeline(output, res, (error) => {
			if (error?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
				console.info('export.client_disconnected');
			} else if (error) {
				console.error('export.stream_failed', error);
			}
		});
	} catch (error) {
		console.error('export.failed', error);
		if (error?.name === 'AccessControlUnavailableError') {
			res.set('Retry-After', String(error.retryAfterSeconds));
		}
		res
			.status(
				error instanceof InvalidExportRequestError ? 400 : error?.name === 'AccessControlUnavailableError' ? 503 : 500,
			)
			.type('text/plain')
			.set('X-Content-Type-Options', 'nosniff')
			.send(failureText(error));
	}
});
```

The router's own `/download` goes further: it holds its response headers until the first row is formatted, so a failure on the first search, or on formatting the first row, still answers with an error status. A body its form parser refuses is answered with its rule's fixed text, as plain text, with the parser's own `4xx` status, and logged as `download.invalid_request`. A successful download carries `X-Content-Type-Options: nosniff`. A client leaving before the export ends is logged at info as `download.client_disconnected`, and any other failure after output has started as `download.stream_failed`.

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

### `AccessControlQueryTooLargeError`, `ACCESS_ENFORCEMENT_QUERY_TOO_LARGE_CODE`

What a read fails with when the search engine refuses it past its clause limit once the catalogue's access filter is applied, and the GraphQL error code it is answered with. See [GraphQL errors](#graphql-errors) and [Export routes](#export-routes).

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
