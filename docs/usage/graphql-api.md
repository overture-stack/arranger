---
sidebar_position: 2.5
---

# GraphQL API

Arranger exposes a single **GraphQL endpoint** per server — the primary programmatic interface for searching a catalogue. A client combines a [SQON](./03-building-sqon-queries.md) filter with field selections, pagination, and sorting; Arranger translates the whole request into an Elasticsearch query and returns the results (see [Query Processing](./02-query-processing.md) for the end-to-end flow).

The schema is **generated per catalogue** from the catalogue's index mapping and [configuration](../concepts.md#catalogues-and-configuration) — there is no hand-written schema, so field names and types vary by catalogue. Discover them at runtime with the [Introspection API](./05-introspection.md).

## Endpoint

```
POST /graphql
```

A running server serves GraphQL at `/graphql` (a local development server, for example, at `http://localhost:5050/graphql`). Requests are standard GraphQL over HTTP: a JSON body with a `query` string and an optional `variables` object. The paths for a given server — including the per-catalogue GraphQL paths used in multi-catalogue mode — are listed by `GET /introspection` (see the [Introspection API](./05-introspection.md)).

## Schema shape

For each catalogue, the root query exposes a field named after the catalogue's **document type** (for example `file` or `participant`, set in the catalogue configuration). That type carries:

| Field | Purpose |
|---|---|
| `hits` | The matching records, as a paginated connection. |
| `aggregations` | Per-field [facet](../concepts.md#facets-buckets-and-aggregations) buckets — each a value and its document count — over the filtered result set. |
| `configs` | The catalogue's table, facet, and display configuration. |
| `mapping` | The raw Elasticsearch mapping, as JSON. |

`hits` and `aggregations` both accept a `filters` argument that takes a SQON.

## Querying records: `hits`

```graphql
query SearchFiles($sqon: JSON, $first: Int, $offset: Int, $sort: [Sort]) {
  file {
    hits(filters: $sqon, first: $first, offset: $offset, sort: $sort) {
      total
      edges {
        node {
          id
          # the remaining fields come from the catalogue's index mapping —
          # discover them with the Introspection API
        }
      }
    }
  }
}
```

with variables:

```json
{
  "sqon": {
    "op": "and",
    "content": [
      { "op": "in", "content": { "fieldName": "data.primary_site", "value": ["Brain"] } }
    ]
  },
  "first": 20,
  "offset": 0,
  "sort": [{ "fieldName": "data.primary_site", "order": "asc" }]
}
```

**`hits` arguments:**

| Argument | Type | Purpose |
|---|---|---|
| `filters` | `JSON` (SQON) | The filter to apply; omit to match all records. |
| `first` | `Int` | Page size (defaults to 10 — see [Defaults and Limits](./07-defaults-and-limits.md)). |
| `offset` | `Int` | Number of records to skip. |
| `sort` | `[Sort]` | Ordering; each `Sort` is `{ fieldName, order, mode, missing }`. |
| `searchAfter` | `JSON` | Cursor for deep pagination, taken from a prior page's `edges.searchAfter`. |
| `trackTotalHits` | `Boolean` | Whether `total` counts all matches (default `true`). |

**`hits` result:** a connection with `total` (the full match count, not just the current page) and `edges`, each holding a `node`. Every `node` has `id` and `score`; its remaining fields are those in the catalogue's index mapping.

## Aggregations

`aggregations` returns, for each requested field, the distinct values (**buckets**) and their document counts in the filtered result set — the data behind a facet panel:

```graphql
query Facets($sqon: JSON) {
  file {
    aggregations(filters: $sqon) {
      data__primary_site {
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

Each field returns a `bucket_count` (the number of distinct values) and `buckets`, where each bucket's `key` is a value and `doc_count` its document count. See [Concepts → Facets, buckets, and aggregations](../concepts.md#facets-buckets-and-aggregations).

**`aggregations` arguments:** `filters` (a SQON), `include_missing` (also count documents missing the field), and `aggregations_filter_themselves` (whether a field's own facet selection constrains its buckets — set `false` for multi-select facet UIs).

:::note Field names: dots become double underscores
GraphQL field names cannot contain dots, so a mapping field such as `data.primary_site` is exposed in the schema as `data__primary_site`. SQON `fieldName` values keep the dotted form (`data.primary_site`); GraphQL **selections** and aggregation names use the `__` form. The [Introspection API](./05-introspection.md) returns the dotted mapping names.
:::

## Discovering the schema

Because the schema is generated per catalogue, use the **[Introspection API](./05-introspection.md)** to discover what you can query without writing a GraphQL query first:

- `GET /introspection/:catalogueId` — every queryable field, its type, and the SQON operators it accepts.
- `GET /introspection/sqon` — the SQON JSON Schema shared across catalogues.

GraphQL's built-in introspection (`__schema` / `__type`) also works, but it is gated by the `disableGraphQLIntrospection` flag — disabled when `NODE_ENV=production` by default (see [Introspection API → GraphQL introspection](./05-introspection.md#graphql-introspection)). Prefer the REST introspection endpoints for tooling, since they are always available.

## Filtering with SQON

The `filters` argument on both `hits` and `aggregations` takes a **SQON**, Arranger's JSON filter language. Build it separately and pass it as a variable, as shown above. See [Building SQON queries](./03-building-sqon-queries.md) and [SQON in detail](./04-sqon-in-detail.md).

:::info **Need Help?**
If you encounter any issues or have questions, please don't hesitate to reach out through our relevant [**community support channels**](https://docs.overture.bio/community/support).
:::
