# Index mappings

An OpenSearch (or Elasticsearch) index mapping defines the fields in your documents and their types. Arranger reads the mapping at startup: it doesn't create or manage it. The mapping is typically created by a data ingestion pipeline (such as Maestro in the Overture platform) or uploaded directly to the search engine.

## What the mapping drives in Arranger

**GraphQL schema generation.** Arranger builds its GraphQL API entirely from the active index mapping. Every field becomes queryable; nested field paths (e.g. `clinical.donor.age`) map to nested GraphQL types. Adding or removing fields in the mapping requires restarting Arranger to pick up the change.

**Available SQON operators.** The field type in the mapping determines which filter operators Arranger accepts for that field:

| Field type                           | Available operators                                               |
| ------------------------------------ | ----------------------------------------------------------------- |
| `keyword`                            | `in`, `not-in`, `some-not-in`, `all`, `wildcard`                  |
| `integer`, `long`, `float`, `double` | `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`               |
| `date`                               | `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`               |
| `boolean`                            | `in`, `not-in`                                                    |
| `text`                               | `wildcard` only; `text` fields are tokenized and cannot be used for facets or `in`/`not-in` filtering. Use `keyword` instead. |
| `nested`                             | operators depend on the sub-field type; queries require a `pivot` |

**Introspection responses.** The introspection API derives its field list and `operators` block directly from the mapping. This is what automated clients and the MCP server use to discover what they can query. See [Introspection API](./05-introspection.md).

**Facet aggregations.** Arranger's aggregation queries are written against the mapping's field paths. A field configured as a facet in `facets.json` must exist in the mapping with a type that supports term aggregations (`keyword` or `boolean`). `text` fields are not suitable for facets.

## Key points for mapping design

- Use `keyword` (not `text`) for any field you want as a filterable facet or exact-match filter.
- Use `nested` type for arrays of objects where per-item filtering matters; this enables the `pivot` feature in SQONs.
- Field names in the mapping become `fieldName` values in SQON filter clauses. Nested paths use dots: `clinical.donor.age`.

## Further reading

For a comprehensive guide on creating and managing index mappings in the Overture platform, covering file-centric vs analysis-centric indexing, index templates, aliases, analyzers, and the Maestro indexing pipeline, see the [index mappings guide](https://docs.overture.bio/guides/administration-guides/index-mappings) in the Overture platform documentation.
