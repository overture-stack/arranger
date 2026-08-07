# Catalogue configuration

Each catalogue in Arranger is controlled by four JSON configuration files. Together they define which index to connect to, how fields are labelled for display, which columns appear in the data table, and which fields are exposed as facet panels.

A fifth file, `network.json`, is optional and only needed to federate queries across several Arranger servers. It is documented separately in [Federated search](../federated-search.md#with-search-server-configuration-files).

Templates for all four files are [in the Arranger repository](https://github.com/overture-stack/arranger/tree/main/apps/search-server/configTemplates). The full JSON schema describing every available option is at [`configTemplates/configs.json.schema`](https://github.com/overture-stack/arranger/blob/main/apps/search-server/configTemplates/configs.json.schema).

## File locations

Configuration files must be placed in the `configs/` directory under the server's working directory, or in the path specified by the `CONFIGS_PATH` environment variable.

In a multicatalogue setup, each catalogue gets its own subdirectory named after the catalogue ID:

```
configs/
├── participants/
│   ├── base.json
│   ├── extended.json
│   ├── facets.json
│   └── table.json
└── samples/
    ├── base.json
    ├── extended.json
    ├── facets.json
    └── table.json
```

In single-catalogue mode, the four files sit directly in `configs/` with no subdirectory.

## base.json

Connects the catalogue to its Elasticsearch index.

```json
{
  "documentType": "file",
  "esIndex": "my-elasticsearch-index"
}
```

- `documentType`: The top-level name used in the generated GraphQL schema (e.g. `file`, `participant`, `analysis`). This becomes the root query field: `{ file { hits { ... } } }`.
- `esIndex`: The name of the Elasticsearch index or alias to query.

### nestingPrefix (optional)

For a data source whose real documents wrap all their content inside one top-level envelope property, rather than exposing fields directly. This is a common shape for data submitted through Lyric, Overture's clinical data submission service, which nests every submitted field under a top-level `data` property alongside its own metadata (`entityName`, `organization`, and similar), instead of indexing those fields at the top level.

```json
{
  "documentType": "donor",
  "esIndex": "donor",
  "nestingPrefix": "data"
}
```

With `nestingPrefix` set, `extended.json`/`facets.json`/`table.json` keep referencing clean, unprefixed field names (`age_at_menarche`, not `data.age_at_menarche`) exactly as they would for a catalogue with no envelope at all; Arranger re-applies the prefix internally against the real Elasticsearch paths for every query, aggregation, sort, and read. A dotted path (e.g. `"envelope.payload"`) walks down through that many nested levels, for a data source with a deeper envelope shape.

**Before setting this, confirm the real index mapping actually nests fields under this path.** A configured `nestingPrefix` that doesn't match the real mapping fails the catalogue at startup (reported via `GET /introspection` with error code `nesting_prefix_not_found`, the same partial-availability mechanism used for other mapping problems) rather than silently falling back to the unwrapped mapping.

**Two things worth knowing before enabling it:**

- **Bandwidth**: because a per-field `_source` request can't safely be narrowed to only the fields a specific query selected without risking a mismatch against a sanitized GraphQL name, Arranger requests the entire envelope from Elasticsearch for every hit when `nestingPrefix` is set, not just the selected fields. This is more data transferred per request than a catalogue with no envelope, though nothing outside the envelope is ever fetched.
- **Field-level access control**: if a future release adds field-level authorization (restricting which fields a given user can see), it will need to account for this catalogue's fetch-everything behaviour specifically. Fetching a field's value and filtering it out of the response afterward is not equivalent to never having fetched it.
- **Environment-variable configuration cannot set this today.** `nestingPrefix` is only readable from a catalogue's `base.json` file; there is currently no corresponding environment variable.

## extended.json

Maps every field to its display name and controls which fields are visible.

```json
{
  "extended": [
    {
      "displayName": "Object ID",
      "fieldName": "object_id"
    },
    {
      "displayName": "Age at Diagnosis",
      "fieldName": "clinical.donor.age_at_diagnosis"
    }
  ]
}
```

- `displayName`: How the field is labelled in the UI and introspection responses.
- `fieldName`: The field's path in the Elasticsearch document. Use dot notation for nested fields.

Fields in the mapping that are omitted from `extended.json` are still queryable via GraphQL but will not appear in the UI components.

## table.json

Configures the columns in the data results table.

```json
{
  "table": {
    "columns": [
      {
        "canChangeShow": true,
        "fieldName": "object_id",
        "show": true,
        "sortable": true
      },
      {
        "canChangeShow": true,
        "fieldName": "analysis.collaborator.name",
        "jsonPath": "$.analysis.collaborator.hits.edges[*].node.name",
        "query": "analysis { collaborator { hits { edges { node { name } } } } }",
        "show": true,
        "sortable": false
      }
    ]
  }
}
```

- `canChangeShow`: Whether users can toggle this column's visibility.
- `show`: Whether the column is visible by default.
- `sortable`: Whether the column header triggers result sorting.
- `jsonPath`: For nested data, the JSON path used to extract the value from the GraphQL response.
- `query`: For nested data, the GraphQL sub-query fragment for this field.

`columns` is optional. If omitted, the table falls back to the first 10 non-nested, non-object fields from `extended.json`.

## facets.json

Defines which fields appear as filterable facet panels.

```json
{
  "facets": {
    "aggregations": [
      {
        "isActive": true,
        "fieldName": "file_type",
        "show": true
      },
      {
        "isActive": true,
        "fieldName": "analysis__collaborator__name",
        "show": true
      }
    ]
  }
}
```

- `isActive`: Whether this aggregation is computed. Set to `false` to disable a facet without removing it from the config.
- `show`: Whether to display this facet panel in the UI.
- `fieldName`: The field to aggregate on.

`aggregations` is optional. If omitted, up to 10 facets are derived from `extended.json` instead, excluding ID fields and nested or object-typed fields.

:::info Nested fields in facets.json use double underscores

In `facets.json`, nested field paths use `__` instead of `.`: write `analysis__collaborator__name`, not `analysis.collaborator.name`. This applies to `fieldName` in facet aggregations only; all other config files use dot notation.

:::

Only fields with `keyword` or `boolean` types in the index mapping are suitable for facet aggregations. `text` fields cannot be aggregated reliably. See [Index mappings](./00-index-mappings.md) for the full type compatibility table.

## Best practices

- Keep `fieldName` values in sync with the actual field paths in your Elasticsearch index mapping. A mismatch silently returns no results for that field.
- `extended.json` is your source of truth for display names; make sure every field a user might see is listed there.
- Mark columns as `sortable: false` for nested or computed fields: Elasticsearch cannot sort directly on nested paths without a specific mapping configuration.
- Use `isActive: false` in `facets.json` to temporarily disable a facet rather than deleting it; re-enabling is then a one-field change.

:::tip Portal customization guide

For a step-by-step walkthrough of configuring a complete data portal, including mock data setup and Arranger component integration, see the [platform guide on customizing the data portal](https://docs.overture.bio/use/administration/customizing-the-data-portal).

:::
