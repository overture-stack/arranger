import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';
import get from 'lodash/get';

export default ({ api, graphqlField, gqlPath }) => {
  let setId = undefined;
  it('creates set successfully', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          mutation {
            newSet: saveSet(type: ${graphqlField}, path: "name", sqon: {}) {
              setId
            }
          }
        `),
      },
    });
    expect(response.errors).to.be.undefined;
    setId = response.data.newSet.setId;
  });
  it('retrieves newly created set successfully', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            sets {
              hits(first: 1000) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        `),
      },
    });
    expect(response.errors).to.be.undefined;
    expect(response.data.sets.hits.edges.map((edge) => edge.node.id)).to.include(setId);
  });
};
