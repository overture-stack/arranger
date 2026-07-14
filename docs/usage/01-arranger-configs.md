# Catalogue configuration

Each catalogue in Arranger is controlled by four JSON configuration files. Together they define which index to connect to, how fields are labelled for display, which columns appear in the data table, and which fields are exposed as facet panels.

Templates for all four files are [in the Arranger repository](https://github.com/overture-stack/arranger/tree/main/apps/search-server/configTemplates). The full JSON schema describing every available option is at [`configTemplates/configs.json.schema`](https://github.com/overture-stack/arranger/blob/main/apps/search-server/configTemplates/configs.json.schema).

## File locations

Configuration files must be placed in the `configs/` directory under the server's working directory, or in the path specified by the `CONFIG_PATH` environment variable.

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

For a step-by-step walkthrough of configuring a complete data portal, including mock data setup and Arranger component integration, see the [platform guide on customizing the data portal](https://docs.overture.bio/guides/administration-guides/customizing-the-data-portal).

:::
