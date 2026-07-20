# Defaults and Limits

Arranger applies default values when a query argument, download request, or environment variable is left unset. Most of these defaults are enforced in resolver and middleware code rather than declared on the GraphQL schema itself, which means they are **not visible through introspection**: a client, code generator, or AI agent that only inspects the schema will not discover them. This page is the single reference for all of them.

:::caution
Omitting an argument does not mean "use everything" or "no limit applies." It means the default below applies. A real integration was caught by this: a stats query that didn't set `first` on a `hits` connection was silently truncated to 10 records.
:::

## Query pagination

| Field     | Argument          | Default | Notes                                                                                                                       |
| --------- | ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `hits`    | `first`           | `10`    | Set `first` explicitly on every `hits` query; omitting it returns only the first 10 matches, with no error or warning.       |
| `hits`    | `trackTotalHits`  | `true`  | Declared on the schema itself (`Boolean = true`), so this one *is* visible via introspection. Set to `false` to skip computing an exact total on very large result sets. |

## Facet and aggregation queries

| Field                    | Argument              | Default                    | Notes                                                                                                                      |
| ------------------------ | --------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `aggregations.buckets`   | `max`                 | `300000`                   | Far larger than Elasticsearch's own terms-aggregation default of 10, so omitting `max` is safe from truncation for most fields, but can be expensive to compute on high-cardinality fields. Set `max` to the number of distinct values you actually expect. |
| any `aggregations` field | `include_missing`     | `true`                      | Adds a synthetic "missing" bucket for documents that don't have a value for the field. Set to `false` to exclude it.       |
| `aggregations.histogram` | `interval`            | `1000`                      | Set `interval` to match the numeric range and bucket resolution you want for the field being histogrammed.                 |
| `aggregations.range`     | `ranges`              | `[{ from: 0 }]`             | A single unbounded-from-zero bucket. Set `ranges` explicitly to define your own bucket boundaries.                          |
| `aggregations.cardinality` | `precision_threshold` | `40000`                   | Trades memory for accuracy on distinct-value estimates. Set explicitly for fields with unusually high or low cardinality.  |
| `aggregations.top_hits`  | `size`                | `1`                         | Number of sample documents returned per bucket. Set `size` to sample more than one.                                        |

## Downloads (CSV/TSV export)

| Behaviour  | Default                                             | Notes                                                                                          |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sort order | Your `sort`, with an `_id: asc` tie-breaker appended | Not overridable. The tie-breaker guarantees deterministic ordering across paginated export batches; without it, ties in your sort field could cause rows to be skipped or repeated across batches. |

## Query validation limits

| Variable            | Default                       | Override                                                                                     |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `GRAPHQL_MAX_ALIASES` | 15 aliased fields per query   | Set the env var, or `maxAliases` in a catalogue's `base.json` (per-catalogue config wins).      |
| `GRAPHQL_MAX_DEPTH`   | 7 levels of selection nesting | Set the env var, or `maxDepth` in a catalogue's `base.json` (per-catalogue config wins).        |
| `MAX_RESULTS_WINDOW`  | 10000 hits per query          | Set the env var, or `maxResultsWindow` in a catalogue's `table.json`. See [Migrating to 3.1](../migration/v3.1.md#max_results_window-is-now-enforced) for details. |

Both `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` apply their defaults whether or not you've set the corresponding environment variable: there is no "unset means unlimited" state for either.

:::info
If you're generating queries programmatically, including through the [MCP server](./06-ai-and-automation.md), assume every default above applies unless you set the value yourself. Only `trackTotalHits` is visible via schema introspection; the rest require reading this page.
:::
