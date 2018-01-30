import mappingToAggsType from './mappingToAggsType';

export default ({ type, fields = '' }) => `
  type ${type.name} {
    mapping: JSON

    hits(
      score: String
      offset: Int
      sort: [Sort]
      filters: JSON
      before: String
      after: String
      first: Int
      last: Int
    ): ${type.name}Connection

    aggregations(
      filters: JSON

      # Should term aggregations be affected by queries that contain filters on their field. For example if a query is filtering primary_site by Blood should the term aggregation on primary_site return all values or just Blood. Set to False for UIs that allow users to select multiple values of an aggregation.
      aggregations_filter_themselves: Boolean
    ): ${type.name}Aggregations
  }

  type ${type.name}Aggregations {
    ${mappingToAggsType(type.mapping)}
  }

  type ${type.name}Connection {
    total: Int!
    edges: [${type.name}Edge]
  }

  type ${type.name}Edge {
    node: ${type.name}Node
  }

  type ${type.name}Node implements Node {
    id: ID!
    score: Int
    ${fields}
  }
`;
