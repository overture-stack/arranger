---
sidebar_position: 2
---

# Concepts

Arranger is a versatile, model-agnostic data discovery API for Elasticsearch and OpenSearch. It turns an index configuration into a working search API and MCP server for AI agent access. A React component library is available for building search UIs on top of it. This page defines the domain terms used throughout the Arranger documentation and codebase.

## Catalogues and configuration

A **catalogue** is one searchable dataset in Arranger. It maps to a single Elasticsearch index and carries its own set of JSON configuration files:

- `base.json` - the Elasticsearch index name and basic settings
- `extended.json` - display names, types, and visibility for each field
- `facets.json` - which fields to expose as filterable facet panels
- `table.json` - which fields to show as columns in the data table

A running Arranger server can host one or more catalogues, each in its own subdirectory under the configuration root directory.

## Facets, buckets, and aggregations

When users explore a dataset they navigate it through **facets**: panels in the search UI, one per filterable field, each showing the distinct values present in the current result set.

Each option within a facet is a **bucket**: a distinct value paired with its document count. For a "Disease type" facet, the buckets might look like:

| Value | Count |
|---|---|
| Leukemia | 42 |
| Lymphoma | 31 |
| Sarcoma | 18 |

Behind each facet is an Elasticsearch **aggregation**: the query Arranger sends to ES to compute those buckets. Aggregations are the technical backend; facets are their user-facing representation.

## Filters, filter clauses, and SQONs

When a user selects one or more facet options, their selection is encoded as a **SQON** (Serializable Query Object Notation) - Arranger's query language. A SQON is a tree structure made up of boolean combinators (`and`, `or`, `not`) and **filter clauses**.

A **filter clause** is a single field-level condition:

```json
{
  "op": "in",
  "content": {
    "fieldName": "disease_type",
    "value": ["Leukemia", "Lymphoma"]
  }
}
```

A SQON wraps one or more filter clauses under a combinator:

```json
{
  "op": "and",
  "content": [
    { "op": "in", "content": { "fieldName": "disease_type", "value": ["Leukemia"] } },
    { "op": ">=",  "content": { "fieldName": "age_at_diagnosis", "value": [18] } }
  ]
}
```

The word **filter** is used two ways: as a verb ("users filter the dataset") and as a noun that can mean either a single filter clause or a full SQON. When the distinction matters, use "filter clause" for one condition and "SQON" for the full query object.

## Vocabulary reference

| Term | Meaning |
|---|---|
| **model-agnostic** | Arranger does not assume a specific data model or schema. Any correctly structured Elasticsearch or OpenSearch index can be used as a catalogue. |
| **catalogue** | One searchable dataset in Arranger, backed by an Elasticsearch index with its own configuration directory. Canadian spelling. |
| **configuration** | The JSON files defining a catalogue (base, extended, facets, table). Use "configuration" in prose; `config` is acceptable in code identifiers. |
| **directory** | A filesystem directory. Not "folder". |
| **aggregation** | The Elasticsearch operation that computes buckets for a facet. |
| **facet** | A filterable field shown as a UI panel with selectable options (buckets). |
| **bucket** | One option within a facet: a distinct value and its document count. |
| **SQON** | The full structured query object passed to Arranger, built from one or more filter clauses. |
| **filter clause** | One field-level condition within a SQON (a single `{op, content}` leaf node). |
| **filter** | (verb) To narrow a dataset by selecting facet options. (noun) A SQON, or informally a single filter clause. |
| **settings** | Elasticsearch's own term for index-level configuration (the ES `settings` API). Use "configuration" for Arranger-level concepts; keep "settings" when mirroring ES language. |
