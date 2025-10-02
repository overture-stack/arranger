# SQON Filter Notation

Serializable Query Object Notation (SQON, pronounced like "Scone") is a custom filter syntax used within Arranger to [consisly state the problem and solution sqons provide]...

The diagram below helps illustrate the where SQONs are used while the example below will show you have they [solve the defined problem]

## Understanding SQON Structure

A SQON object consists of two types of nested objects that work together to create filter expressions:

- **Value Objects** - Define the field and values being queried (the building blocks)
- **Operation Objects** - Apply logic to filter and combine value objects

### Value Objects

Value objects are the building blocks that specify the field being queried and the values used for the query.

```json showLineNumbers
{
  "fieldName": "sequencing_instrument",
  "value": ["Illumina NextSeq 550"]
}
```

:::note **What this means:**
This value object specifies the field `sequencing_instrument` and the value `"Illumina NextSeq 550"` that will be used for filtering.
:::

#### Value Object Properties

| Property    | Type                  | Description                                                          |
| ----------- | --------------------- | -------------------------------------------------------------------- |
| `fieldName` | `string`              | Name of the field this operation applies to                          |
| `value`     | `Array<any>` / `any`  | List of values for "in" operations, or scalar value for range queries |

### Field Operations

Field operations wrap value objects and specify how to match field values.

```json showLineNumbers
{
  "op": "in",
  "content": {
    "fieldName": "host_age",
    "value": ["20 - 29"]
  }
}
```

:::note **What this means:**
This filters for records where the host age is "20 - 29".
:::

#### Field Operation Properties

| Property  | Type          | Description                                                |
| --------- | ------------- | ---------------------------------------------------------- |
| `op`      | `string`      | Operation to apply: `"in"`, `">="`, `"<="`                |
| `content` | `ValueObject` | Value object specifying the field and values to match     |

#### Available Operations

| Operation | Description                                      | Value Type         |
| --------- | ------------------------------------------------ | ------------------ |
| `"in"`    | Field value must match one of the listed values  | Array              |
| `">="`    | Field value must be greater than or equal to     | Scalar (number)    |
| `"<="`    | Field value must be less than or equal to        | Scalar (number)    |

### Combination Operations

Combination operations group one or more field operations together using boolean logic (AND, OR, NOT).

```json showLineNumbers
{
  "op": "and",
  "content": [
    { ... },
    { ... }
  ]
}
```

:::note **What this means:**
This combines multiple filter operations where **all** conditions must be true (AND logic). The placeholder `{ ... }` objects would be replaced with actual field operations.
:::

#### Combination Operation Properties

| Property  | Type                      | Description                                           |
| --------- | ------------------------- | ----------------------------------------------------- |
| `op`      | `string`                  | Boolean operation to apply: `"and"`, `"or"`, `"not"` |
| `content` | `Array<OperationObject>`  | List of operation objects that the boolean operation applies to |

:::tip **Important:**
The top level of a SQON must always be a combination operation, even if only a single filter is being applied.
:::

## Complete Example

All filters applied in the faceted search panel are displayed in the SQON viewer:

![Entity](../assets/sqon_query.jpg 'Sqon Viewer')

The selection of filters shown above is recorded in SQON format as follows:

```json showLineNumbers
{
  "op": "and",
  "content": [
    {
      "op": "in",
      "content": {
        "fieldName": "experiment.sequencing_instrument",
        "value": ["Illumina NextSeq 550"]
      }
    },
    {
      "op": ">=",
      "content": {
        "fieldName": "first_published_at",
        "value": 1640926800000
      }
    },
    {
      "op": "<=",
      "content": {
        "fieldName": "first_published_at",
        "value": 1672549199999
      }
    },
    {
      "op": "in",
      "content": {
        "fieldName": "host_age",
        "value": ["20 - 29"]
      }
    },
    {
      "op": "in",
      "content": {
        "fieldName": "sample_collection.geo_loc_province",
        "value": ["Ontario"]
      }
    }
  ]
}
```

:::note **What this means:**
This SQON filters for records where:
- Sequencing instrument is "Illumina NextSeq 550" **AND**
- First published date is between December 31, 2021 and December 31, 2022 **AND**
- Host age is in the 20-29 range **AND**
- Sample collection province is Ontario

All date values are represented as [Unix timestamps](https://www.unixtimestamp.com/).
:::

## Building Complex Queries

You can create more sophisticated filters by nesting combination operations:

```json showLineNumbers
{
  "op": "and",
  "content": [
    {
      "op": "or",
      "content": [
        {
          "op": "in",
          "content": {
            "fieldName": "sample_collection.geo_loc_province",
            "value": ["Ontario", "Quebec"]
          }
        },
        {
          "op": "in",
          "content": {
            "fieldName": "sample_collection.geo_loc_country",
            "value": ["United States"]
          }
        }
      ]
    },
    {
      "op": "in",
      "content": {
        "fieldName": "host_age",
        "value": ["20 - 29", "30 - 39"]
      }
    }
  ]
}
```

:::note **What this means:**
This SQON filters for records where:
- (Province is Ontario **OR** Quebec **OR** Country is United States) **AND**
- Age is between 20-39 years old

This demonstrates how you can combine OR logic for location with AND logic for age restrictions.
:::

## The Life of a SQON Filter

### A relatively simple SQON filter

```

```

### Converted into to a more complex GraphQL query

```

```

### Used to create an even more complex Elasticsearch query

```

```

:::info **Need Help?**
If you encounter any issues or have questions, please don't hesitate to reach out through our relevant [**community support channels**](https://docs.overture.bio/community/support).
:::
