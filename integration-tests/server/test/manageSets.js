import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, graphqlField, gqlPath }) => {
  let setId = undefined;

  it('creates set successfully', async () => {
    const { data } = await api
      .post({
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
      })
      .catch((err) => console.log(err));

    expect(data.errors).to.be.undefined;

    setId = data.data.newSet.setId;
  });

  it('retrieves newly created set successfully', async () => {
    const { data } = await api.post({
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

    expect(data.errors).to.be.undefined;
    expect(data.data.sets.hits.edges.map((edge) => edge.node.id)).to.include(setId);
  });
};
