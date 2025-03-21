

# Federated Search
![VPCzJyCm48Pt_ufJftP0x1bGAuIgIhG22XDYEE9hQicnW-qW-FVu8qT2HTlfSkzpxtrONVg0BlIj5bW7ww3yNZnnY3v_YIvYgbOTcW2pbNDe6d8LR56PMOHoS0wwjUQWceoLy1ou9tJrCOCbl0oEninVjjzPIJ1trDf0YrILCqA8lE_LJLu2edkw2N1Tr7C-wiM-WYVwwCa7gFCt79GcKRI_5Ce1yV2h3stuAcpEsOrH (1)](https://github.com/overture-stack/arranger/assets/1486054/87bb0689-38c6-49eb-ab65-96696a04d86a)

## Prerequisites
- Local data must be configured
- ENV flag passed into process
- "search" config file present
  
## Config
- Read "search config" from file
- Export object containing node data for use in gql endpoint

Example Config provided:

| Field         | Type   | Note                                                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| endpoint      | string | Full url to gql endpoint                                                                                                        |
| arrangerField | string | Endpoints can have other data on the root object. Need to get specific Arranger config object. Appears to be "file" by default. |

Example Search Node data:

| Field  | Description                 |
| ------ | --------------------------- |
| url    | gql endpoint                |
| name   | name of node eg. Toronto    |
| schema | version of Arranger running |
| status | node status eg. "connected" |

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
  # "file" is the Arranger field
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
  # input: typename "fileAggregations" retrieved from previous query
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
```js
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
Creates a union of all schema types into stitched schema including search node bucket breakdown. A configuration method should be provided to admins giving them freedom to filter out, or map fields to their liking.

Introspection response object
```json
{
  "name": "analysis__analysis_version",
  "type": {
    "name": "NumericAggregations"
  }
}
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
		1. If `name` AND `type.name` pair exist in `stitched` - return
		2. else - add `[name]: [type.name]`  to `stitched` 
		   
Example:

Inputs - GQL responses from introspection query
Node A 
```js
// GQL resp
{
  "name": "fileAggregations",
  "fields": [
    {
      "name": "donors__gender", // field name to merge
      "type": {
        "name": "Aggregations" // type
      }
    }
  ]
}

```
Node B:
```js
{
  "name": "fileAggregations",
  "fields": [
    {
      "name": "donors__gender", // field name to merge
      "type": {
        "name": "Aggregations" // type
      }
    },
    {
      "name": "donors__age", 
      "type": {
        "name": "NumericAggregations" 
      }
    }
  ]
}
```

Output - Stitched schema
```graphql
schema {
  query {
    network {
      aggregations {
        donors__gender {
          search_node_agg: Aggregation
          agg: Aggregation
        }
        donors__age: {
          search_node_agg: NumericAggregation
          agg: NumericAggregation
        }
      }
    }
  }
}

```

Sample query to stitched schema:

```js
// Node A response
{
  donor: {
    aggregations: {
      __typename: "Aggregation",
      gender: {
        buckets: [
          {
            key: "Male",
            bucket_count: 123,
          },
          {
            key: "Female",
            bucket_count: 456,
          },
        ],
      },
    },
  },
};

// Node B response
{
  donor: {
    aggregations: {
      gender: {
        __typename: "Aggregation",
        buckets: [
          {
            key: "Male",
            bucket_count: 789,
          },
          {
            key: "Female",
            bucket_count: 234,
          },
        ],
      },
    },
  },
};

// Full response
{
  donor: {
    network: {
      aggregations: {
        gender: {
          search_node_agg: {
            buckets: [
              {
                key: "Node A",
                bucket_count: 579, // male + female
              },
              {
                key: "Node B",
                bucket_count: 1023, // male + female
              },
            ],
          },
          agg: {
            buckets: [
              {
                key: "Male",
                bucket_count: 912, // Node A male + Node B male
              },
              {
                key: "Female",
                bucket_count: 456, // Node A female + Node B female
              },
            ],
          },
        },
      },
    },
  },
};


```
## Generate Resolvers
![Untitled-2024-01-24-1548](https://github.com/overture-stack/arranger/assets/1486054/09ff0512-da31-4c51-b2a3-e7a161843edf)

New resolvers are needed to aggregate the aggregates for all available aggregation types.
ref: https://github.com/overture-stack/arranger/blob/develop/modules/server/src/schema/Aggregations.js

- Individual search node data is queried (http) 
- Apply data transforms based on the `__typename` field eg. `NumberAggregation`
- Add additional data eg. `search_node` breakdown of aggregate
- Return fully resolved request
