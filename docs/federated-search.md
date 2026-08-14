---
sidebar_position: 6
---

# Arranger Federated search

Arranger can answer a single query using data held on several Arranger servers at once. Each server keeps its own index and never ships documents anywhere; only aggregate counts cross the wire. The querying server merges those counts into one response.

The feature has three names in the codebase and in older documentation: **federated search**, **network search**, and **network aggregation**. They all mean this feature. Configuration and GraphQL field names use `network`.

:::info Aggregates only

Federated search returns **counts, not documents**. You get per-field bucket counts and a total hit count per node. There is no federated `hits` list: a user cannot page through records held on a remote node through the federated query. Point them at that node's own portal for record-level access.

:::

---

## When to use it

Use federated search when several organisations each run their own Arranger over their own data, and you want one portal that reports totals across all of them without any organisation handing over its records.

A typical arrangement: each site runs a normal Arranger server, and one of them (or a separate server) additionally carries a `network` configuration listing the others. That server exposes the federated query. Sites remain independent, each controlling its own index, access rules, and uptime.

---

## How it works

**At startup**, the querying server contacts every remote node listed in its `network` configuration and asks which aggregation fields that node has, using a GraphQL `__type` introspection query against `<documentType>Aggregations`. It builds the federated schema from the **union** of the fields discovered across all nodes, plus the local node's own fields.

**Per query**, the server:

1. Sends each remote node a query for only the requested fields that node actually has, plus that node's total hits.
2. Queries the local node, if one is configured, through its in-process resolvers rather than over HTTP.
3. Merges the returned buckets field by field, summing `doc_count` for buckets that share a `key`.
4. Returns the merged aggregations alongside a per-node status list.

All node requests run concurrently, and one node failing does not fail the query. See [Node status and failures](#node-status-and-failures).

### Field discovery is a union, not an intersection

A field present on only one node still appears in the federated schema. When a node does not have a requested field, that node contributes a single sentinel bucket instead:

```json
{ "key": "___aggregation_not_available___", "doc_count": 4210 }
```

`doc_count` is that node's total hits for the query. This keeps the arithmetic honest: the merged buckets plus the sentinel bucket account for every matching document across the network, so an interface can show "4,210 records at Node B, not broken down by this field" rather than silently under-reporting.

:::warning Nodes must agree on field names

Merging is by **field name and aggregation type**. Two nodes only combine on a field if both call it the same thing. `donor__gender` on one node and `donor_sex` on the other produce two separate fields, each carrying a sentinel bucket from the node that lacks it. Agreeing on index field names across the network is a prerequisite, not something Arranger can reconcile for you.

:::

---

## Configuration

Configuration differs between the two ways Arranger is run. Pick the one matching your deployment.

### With `search-server` (configuration files)

Add a `network.json` to the catalogue's configuration directory, alongside `base.json` and the other files described in [Catalogue configuration](./reference/01-arranger-configs.md).

```json
{
  "network": {
    "localNode": {
      "displayName": "Toronto",
      "nodeId": "toronto"
    },
    "remoteNodes": [
      {
        "displayName": "Montreal",
        "documentType": "file",
        "graphqlUrl": "https://montreal.example.org/graphql",
        "nodeId": "montreal"
      },
      {
        "displayName": "Vancouver",
        "documentType": "file",
        "graphqlUrl": "https://vancouver.example.org/graphql",
        "nodeId": "vancouver",
        "requests": {
          "headers": ["Authorization", "X-Api-Key"]
        }
      }
    ],
    "remoteRequests": {
      "headers": ["Authorization"]
    }
  }
}
```

| Field                            | Required                   | Description                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localNode.displayName`          | yes, to include local data | Label for this server's own catalogue in the results. Omit the whole `localNode` block to federate over remote nodes only.                                                                                                       |
| `localNode.nodeId`               | recommended                | Stable identifier, used by `nodesFilter`.                                                                                                                                                                                        |
| `remoteNodes[].displayName`      | yes                        | Label for this node in the results. Also used to match responses back to nodes, so keep it unique across the network.                                                                                                            |
| `remoteNodes[].documentType`     | yes                        | The remote catalogue's `documentType`, meaning its root GraphQL field (for example `file`). Arranger appends `Aggregations` to this value during field discovery, so give the bare document type, not an aggregations type name. |
| `remoteNodes[].graphqlUrl`       | yes                        | The remote Arranger's GraphQL endpoint.                                                                                                                                                                                          |
| `remoteNodes[].nodeId`           | recommended                | Stable identifier, used by `nodesFilter`.                                                                                                                                                                                        |
| `remoteNodes[].requests.headers` | no                         | Header names to forward to this node. **Replaces** `remoteRequests.headers` for this node rather than adding to it.                                                                                                              |
| `remoteRequests.headers`         | no                         | Header names to copy from the incoming request onto every outgoing remote request.                                                                                                                                               |

**Header passthrough is how authorization reaches remote nodes.** Listing `Authorization` copies the caller's token onto each remote request, letting every node apply its own access rules to the caller's identity. Only list headers the remote nodes should genuinely receive: each name listed is forwarded verbatim to every node it applies to.

### With `graphql-router` (library)

When embedding [`@overture-stack/arranger-graphql-router`](https://github.com/overture-stack/arranger/tree/main/modules/graphql-router) directly, the `network` block takes `localNode` and `remoteNodes` as above, but **not** `remoteRequests` or `remoteNodes[].requests`. Those two are `search-server` configuration-file conveniences: the server normalizes them into a `customizeRemoteRequest` function before handing the configuration to the library. At the library level, supply that function yourself.

```ts
const router = await arrangerRouter({
  configs: {
    documentType: "file",
    esHost: "http://localhost:9200",
    esIndex: "file_centric",
    network: {
      customizeRemoteRequest: ({ context, remoteNode }) => ({
        headers: {
          Authorization: context.request.headers.get("Authorization") ?? "",
        },
      }),
      localNode: { displayName: "Toronto", nodeId: "toronto" },
      remoteNodes: [
        {
          displayName: "Montreal",
          documentType: "file",
          graphqlUrl: "https://montreal.example.org/graphql",
          nodeId: "montreal",
        },
      ],
    },
  },
});
```

`customizeRemoteRequest` runs once per node per query and receives that node's configuration, so it can vary credentials by destination.

### Remote nodes must allow GraphQL introspection

Field discovery uses a GraphQL `__type` query. A remote node running with [`disableGraphQLIntrospection`](./reference/07-feature-flags.md) set to `true` fails discovery and is reported as an errored node for the lifetime of the querying server's process.

This matters because `disableGraphQLIntrospection` defaults to `true` when `NODE_ENV=production`. **Any node serving as a remote target in a federated deployment must explicitly set it to `false`.** Replacing this dependency with the REST [Introspection API](./reference/05-introspection.md) is tracked as tech debt.

---

## Querying

`network` is a root field on the catalogue's GraphQL schema, sitting beside the document type field.

```graphql
query FederatedFacets($filters: JSON) {
  network(filters: $filters) {
    nodes {
      nodeId
      name
      hits
      status
      errors
    }
    aggregations {
      donor__gender {
        bucket_count
        buckets {
          key
          doc_count
        }
      }
    }
  }
}
```

### Arguments

| Argument                         | Type       | Description                                                                                                    |
| -------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `aggregations_filter_themselves` | `Boolean`  | Passed through to each node's aggregation query.                                                               |
| `filters`                        | `JSON`     | A [SQON](./reference/04-sqon-in-detail.md) applied on every node. A malformed value is rejected with an error. |
| `include_missing`                | `Boolean`  | Passed through to each node's aggregation query.                                                               |
| `nodesFilter`                    | `[String]` | Restrict the query to these `nodeId` values. Absent or empty means all nodes.                                  |

`nodesFilter` matches on `nodeId` only. A node configured without a `nodeId` is silently excluded whenever `nodesFilter` is non-empty, so give every node a `nodeId` if you intend to use it.

### Response

**`aggregations`** holds the merged result per field. `buckets` is the union of keys across nodes, with `doc_count` summed per key. `bucket_count` is recomputed from the merged bucket list, so it reflects distinct keys across the network rather than any single node's count.

**`nodes`** reports every configured node, including those that failed.

| Field    | Description                                                             |
| -------- | ----------------------------------------------------------------------- |
| `errors` | Error message when `status` is `ERROR`; an empty string otherwise.      |
| `hits`   | Total documents matching `filters` on that node; `0` for a failed node. |
| `name`   | The configured `displayName`.                                           |
| `nodeId` | The configured `nodeId`, if any.                                        |
| `status` | `OK` or `ERROR`.                                                        |

Nodes are sorted by `name`, so local and remote nodes interleave rather than grouping by kind.

---

## Node status and failures

Federated search degrades rather than failing. There are three distinct failure points.

**Startup discovery failure.** A node was unreachable, or returned an unusable schema, when the server booted. The server logs the reason, starts anyway, and reports that node in `nodes` with `status: "ERROR"` and `hits: 0`. There is no runtime retry: the node stays errored until the querying server restarts.

**Query-time failure.** A node was reachable at startup but failed or timed out on this query. It appears with `status: "ERROR"`, `hits: 0`, and the error message. Every other node's data is still returned.

**No fields anywhere.** If no node exposes any supported aggregation field, the federated schema cannot be built. The server logs an error and starts **without** the `network` field on the schema, so federated queries fail schema validation. Check that remote nodes allow introspection and that their `documentType` values are correct.

Because a failed node reports `hits: 0` rather than an absence, an interface that sums `hits` across `nodes` silently under-counts during an outage. Read `status` before presenting network totals as complete.

---

## Limitations

- **Categorical fields only.** Only the `Aggregations` type federates. Numeric and date fields, which Arranger exposes as `NumericAggregations`, are excluded from the federated schema entirely: they do not appear under `network.aggregations` even when every node has them.
- **No document-level results.** Counts only. See the note at the top of this page.
- **One local node.** A server contributes at most one of its own catalogues to the network. Federating multiple local catalogues from a multicatalogue server is not yet supported.
- **Version parity is assumed.** Nodes are expected to run compatible Arranger versions. There is no capability negotiation and no version check at startup.
- **No live health monitoring.** Node status reflects the current query and the startup discovery result. Nothing polls nodes in between.

---

## In the interface

[Arranger Charts](./charts.md) includes `NetworkNodesChart`, a bar chart of hit counts per node that reads `network.nodes` from the federated response. Charts using the network query accept a `networkNodesFilter` array, passed through as the `nodesFilter` argument, letting a portal offer per-node toggles.

---

## Related pages

- [Catalogue configuration](./reference/01-arranger-configs.md): the other configuration files in a catalogue directory
- [Feature flags](./reference/07-feature-flags.md): including `disableGraphQLIntrospection`
- [Introspection API](./reference/05-introspection.md): the REST alternative to GraphQL introspection
- [SQON in detail](./reference/04-sqon-in-detail.md): the filter format accepted by `filters`
- [Arranger Charts](./charts.md): `NetworkNodesChart` and network-aware chart queries
