# Index Mappings

:::tip Resources
For a comprehensive guide on index mappings, including detailed explanations, examples, and configuration instructions, please refer to our [**guide on index mappings**](https://docs.overture.bio/guides/administration-guides/index-mappings).

This guide will provide:

- A detailed breakdown of index mapping components
- File-centric vs. Analysis-centric indexing
- Info on how to update index templates
- Best practices for mapping configurations
:::


Index mappings are crucial for Arranger's functionality. They define how documents and their fields are stored and indexed in Elasticsearch, which directly impacts how Arranger can query and display your data.

### Why Index Mappings Matter for Arranger

1. **Data Model**: Mappings define the structure of your Elasticsearch documents, allowing Arranger to understand and interact with your data correctly.

2. **GraphQL queries**: Arranger uses the index mapping to generate its GraphQL schema, which is the basis for all queries and mutations.

:::info Arranger uses Elasticsearch 7 

Our search platform is built on and compatible with version 7.x of Elasticsearch. All queries to ES must follow that version's syntax and conventions.

:::
