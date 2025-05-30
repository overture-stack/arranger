import mappingToAggsType from './mappingToAggsType.js';

const createConnectionType = ({ type }) => {
	return `type ${type.name}Connection {
    total: Int!
   edges: [${type.name}Edge]
  }`;
};

export default ({ type, fields = '', createStateTypeDefs = true }) => {
	return `
    type ${type.name} {
      aggregations(
        filters: JSON
        include_missing: Boolean
        # Should term aggregations be affected by queries that contain filters on their field. For example if a query is filtering primary_site by Blood should the term aggregation on primary_site return all values or just Blood. Set to False for UIs that allow users to select multiple values of an aggregation.
        aggregations_filter_themselves: Boolean
      ): ${type.name}Aggregations

      configs: ${createStateTypeDefs ? 'ConfigsWithState' : 'ConfigsWithoutState'}

      hits(
        score: String
        offset: Int
        sort: [Sort]
        filters: JSON
        before: String
        after: String
        first: Int
        last: Int
        searchAfter: JSON
        trackTotalHits: Boolean = true
      ): ${type.name}Connection
      mapping: JSON
    }

    type ${type.name}Aggregations {
      ${mappingToAggsType(type.mapping)}
    }


    ${createConnectionType({ type })}
  

    type ${type.name}Edge {
      searchAfter: JSON
      node: ${type.name}Node
    }

    type ${type.name}Node implements Node {
      id: ID!
      score: Int
      ${fields}
    }
  `;
};
