const { graphql } = require('graphql');

export default ({ esClient, query, schema, variables }) => {
  return graphql({
    schema,
    contextValue: {
      esClient,
      schema,
    },
    source: query,
    variableValues: variables,
  });
};
