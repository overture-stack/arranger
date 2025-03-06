# SQON Filter Notation

<!--To understand SQONs better we should explain why they are important and useful in arranger-->

Arranger uses a custom filter syntax known as Serializable Query Object Notation (SQON, pronounced like "Scone"), to provide a flexible system for combining filters in a JSON object format.

- A SQON object consists of two types of nested objects, **Value Objects** and **Operation Objects**.

## Value Objects

 Value objects specify the field being queried and the values used for the query. This filter can specify to include or exclude fields with any of the listed values. It will have the following format:

    ```SQON
        {
        "fieldName":"", //name of the field this operation applies to
        "value":[] //List of values for the field if using the "in" operation, or a scalar value for ">=" and "<=" operations
        }
    ```

## Operation Logic

Operation objects apply boolean logic (AND, OR, NOT) to a list of operation objects. These can be either **combination operations** or **field operations**

### Combination Operations

Combination operations are used to group one or more filters together. For example:

```SQON
{
  "op":"", // Operation to apply to content, this can be ["and", "or", "not"]
  "content":[] // List of Operation objects that the boolean operation will apply to
}
```

**Tip:** The top level of a SQON must always be a Combination Operation, even if only a single filter is being applied.

### Field Operations

Field operations are used filter value objects. They have the following structure: 

```SQON
{
  "op":"", //Operation to apply to content ["in", "<=", ">="]
  "content":{} //Value object specifying the field and list of values that the field must be "in" or "not-in"
}
```

## Example SQON

All filters applied in the facetted search panel get displayed in the SQON viewer:

![Entity](../assets/sqon_query.jpg 'Sqon Viewer')

The selection of filters above is recorded in SQON as follows:

```SQON
  {
    "content": [
      {
        "content": {
          "fieldName": "analysis.experiment.sequencing_instrument",
          "value": [
            "Illumina NextSeq 550"
          ]
        },
        "op": "in"
      },
      {
        "content": {
          "fieldName": "analysis.first_published_at",
          "value": 1640926800000
        },
        "op": ">="
      },
      {
        "content": {
          "fieldName": "analysis.first_published_at",
          "value": 1672549199999
        },
        "op": "<="
      },
      {
        "content": {
          "fieldName": "analysis.host.host_age_bin",
          "value": [
            "20 - 29"
          ]
        },
        "op": "in"
      },
      {
        "content": {
          "fieldName": "analysis.sample_collection.geo_loc_province",
          "value": [
            "Ontario"
          ]
        },
        "op": "in"
      }
    ],
    "op": "and"
  }
  ```

:::info
Note that all date values are represented as [Unix timestamps](https://www.unixtimestamp.com/).
:::
