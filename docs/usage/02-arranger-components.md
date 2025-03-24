# Arranger Configs

Arranger offers its own front-end library of reusable components to facilitate querying Elasticsearch indices, leveraging the versatile GraphQL syntax.

    :::tip Portal Customization Guide

    For more comprehensive information on customizing Arranger, including mock data and step by step instructions, we recommend [**using our local quickstart**](https://docs.overture.bio/guides/getting-started#overture-platform-quick-start) and following along with our [**platform guide on customizing the data portal**](https://docs.overture.bio/guides/administration-guides/customizing-the-data-portal)

    :::

## Configuration Files Overview

Four main configuration files control Arranger, and its components' behaviours:

1. **base.json**: Defines the core settings for the Elasticsearch index (Important for the Arranger Server).
2. **extended.json**: Specifies all fields and their display names.
3. **table.json**: Configures the columns displayed in the data table.
4. **facets.json**: Defines the aggregations (facets) for data exploration and filtering.

<br/>

    :::info Configuration File Location

    Templates of these files can be [found in the Arranger repository located here](https://github.com/overture-stack/arranger/tree/develop/modules/server/configTemplates). Active configuration files must be stored in a `configs` folder located within the `app/modules/server/` directory (unless specified otherwise using the `CONFIG_PATH` environment variable).

    :::

## Base Configuration (base.json)

The `base.json` file contains two essential fields:

    ```json
    {
    	"documentType": "file",
    	"index": "my-elasticsearch-index"
    }
    ```

- `documentType`: Specifies the mapping type (e.g., "file" or "analysis").
- `index`: Names the Elasticsearch index to be used.

## Extended Configuration (extended.json)

The `extended.json` file defines all fields and their display names for the front-end:

    ```json
    {
    	"extended": [
    		{
    			"displayName": "Object ID",
    			"fieldName": "object_id"
    		},
    		{
    			"displayName": "Analysis ID",
    			"fieldName": "analysis.analysis_id"
    		},
    		{
    			"displayName": "Treatment Duration (Days)",
    			"fieldName": "analysis.donor.primaryDiagnosis.treatment.treatmentDuration"
    		}
    	]
    }
    ```

- `displayName`: How the field is shown in the UI.
- `fieldName`: The field's path in the Elasticsearch document. Use dot notation for nested fields.

## Table Configuration (table.json)

The `table.json` file configures the data table columns:

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
    				"fieldName": "analysis.analysis_id",
    				"show": true,
    				"sortable": true
    			},
    			{
    				"canChangeShow": true,
    				"fieldName": "analysis.collaborator.name",
    				"jsonPath": "$.analysis.collaborator.hits.edges[*].node.name",
    				"query": "analysis { collaborator { hits { edges { node { name } } } } }",
    				"show": true,
    				"sortable": true
    			}
    		]
    	}
    }
    ```

- `canChangeShow`: Whether users can toggle column visibility.
- `fieldName`: The field's path in the Elasticsearch document.
- `jsonPath`: JSON path for extracting nested data.
- `query`: GraphQL query for retrieving nested data.
- `show`: Whether the column is visible by default.
- `sortable`: Whether the column can be sorted.

## Facet Configuration (facets.json)

The `facets.json` file defines aggregations for filtering:

    ```json
    {
    	"facets": {
    		"aggregations": [
    			{
    				"active": true,
    				"fieldName": "file_type",
    				"show": true
    			},
    			{
    				"active": true,
    				"fieldName": "analysis__collaborator__name",
    				"show": true
    			}
    		]
    	}
    }
    ```

- `active`: Whether the aggregation is enabled.
- `fieldName`: The field to aggregate on. Use double underscores for nested fields.
- `show`: Whether to display this aggregation in the UI.

<br/>

    :::info

    In `facets.json`, use double underscores (`__`) instead of dots for nested fields. For example, use `analysis__collaborator__name` instead of `analysis.collaborator.name`.

    :::

## Best Practices

1. Ensure `fieldName` values accurately reflect your Elasticsearch document structure.
2. Use meaningful `displayName` values for better user experience.
3. Consider which columns should be sortable and visible by default in `table.json`.
4. Choose relevant fields for faceting in `facets.json` to aid in data exploration.
5. Test your configurations thoroughly to ensure they work as expected with your data.

By properly configuring these files, you can customize Arranger to effectively display and interact with your Elasticsearch data.
