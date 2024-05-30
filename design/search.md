



![[VPCzJyCm48Pt_ufJftP0x1bGAuIgIhG22XDYEE9hQicnW-qW-FVu8qT2HTlfSkzpxtrONVg0BlIj5bW7ww3yNZnnY3v_YIvYgbOTcW2pbNDe6d8LR56PMOHoS0wwjUQWceoLy1ou9tJrCOCbl0oEninVjjzPIJ1trDf0YrILCqA8lE_LJLu2edkw2N1Tr7C-wiM-WYVwwCa7gFCt79GcKRI_5Ce1yV2h3stuAcpEsOrH (1).svg]]



# Main

## Prerequisites
- Local data must be configured
- ENV flag passed into process
- "search" config file present
  
## Config
- Read "search config" from file
- Config must contain the following for reach node:

| Name          | Type   | Note                                                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| endpoint      | string | Full url to gql endpoint                                                                                                        |
| arrangerField | string | Endpoints can have other data on the root object. Need to get specific Arranger config object. Appears to be "file" by default. |
## Request Nodes
Outline:
- GQL HTTP calls to endpoints
- Specify only returning "arrangerField" in gql query
- Handles network level errors eg. node not found

Query step:
- Read `aggregations` field which Arranger generates by default (`aggsState` isn't always generated - only for UI?)
- Get field name and type eg.  `donor_specimen_sample: NumericAggregation`

Sample query:
```graphql
{
  # This is the root arranger type
  RootType: __type(name:"file"){
    name
    fields {
      name
      type {
        name
      }
    }
  }
  # This is the data we are interested in, just aggregations
  # input: typename from above query
  Aggregations: __type(name:"fileAggregations"){
    name
    fields {
      name # field name
      type {
        name # type name for resolvers
      }
    }
  }
}
```

Sample response:
```json
{
  "data": {
    "RootType": {
      "name": "file", // arranger root field
      "fields": [
        {
          "name": "aggregations",
          "type": {
            "name": "fileAggregations"
          }
        },
        {
          "name": "configs",
          "type": {
            "name": "ConfigsWithState"
          }
        },
        {
          "name": "hits",
          "type": {
            "name": "fileConnection"
          }
        },
        {
          "name": "mapping",
          "type": {
            "name": "JSON"
          }
        }
      ]
    },
    "Aggregations": {
      "name": "fileAggregations",
      "fields": [
        {
          "name": "analysis__analysis_id", // field name to merge
          "type": {
            "name": "Aggregations" // type for resolvers
          }
        },
        ...
        {
          "name": "analysis__analysis_version",
          "type": {
            "name": "NumericAggregations"
          }
        },
```

## Merge Schemas
Creates a union of all schema types into stitched schema

Introspection response object
```json
{
	"name": "analysis__analysis_version",
	"type": {
		"name": "NumericAggregations"
	}
},
```

GQL schema type:
```gql
{
	analysis__analysis_version: NumericAggregations
}
```

Process:
1. Create stitched schema `stitched` from local schema aggregation fields
3. For each *n* remote schema aggregations:
	1. iterate fields
		1. If `name` AND `type.name` exist in `stitched` - return
		2. else - add `[name]: [type.name]`  to `stitched` 
		   
Example:

## Generate Resolvers



but it's startup time so we have lots of time dont pre optimise

name + type + version
