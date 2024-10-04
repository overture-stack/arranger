# Arranger Configs

Arranger metadata files are JSON files that describe the available fields in the index mapping and control the UI behavior. You need to provide four metadata files to Arranger:

| File | Description|
|--|--|
| aggs-state.json | Configures the search filters and aggregations in the facet panel of the data portal. |
| columns-state.json | Configures the data columns in the search results table of the data portal. |
| extended.json | Provides extended (extra) configurations for your Elasticsearch index mapping. |
| matchbox-state.json | Configures the quick search settings for specified fields in the data portal. |

You can refer to the <a href="https://github.com/overture-stack/dms/tree/develop/example-data/arranger_metadata" target="_blank" rel="noopener noreferrer">sample JSON files</a> created for the default `file_centric_1.0` index mapping.

<!--Elaboration would be nice here-->

### Aggs-state.json

The `aggs-state.json` file allows you to configure the search filters and aggregations that will be available in the facet panel of the data portal. Aggregations provide insights into the distribution of data based on specified criteria, enabling users to filter and refine their search results.

### Columns-state.json

The `columns-state.json` file is used to configure the data columns that will be displayed in the search results table of the data portal. You can specify the fields from your index mapping that you want to include as columns in the table.

### Extended.json

The `extended.json` file provides additional configurations for your Elasticsearch index mapping. It allows you to define custom behaviors and settings specific to your data model.

### Matchbox-state.json

The `matchbox-state.json` file is used to configure the quick search settings for specified fields in the data portal. It defines which fields will be considered for quick search queries and how the search results will be displayed.

These metadata files play a crucial role in defining the functionality and output of Arranger. Customize them according to your requirements to provide a tailored search experience for your users.
