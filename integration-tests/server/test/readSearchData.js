import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';
import get from 'lodash/get';

export default ({ api, graphqlField, gqlPath }) => {
  it('reads aggregations properly', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });
    expect(response).to.eql({
      data: {
        model: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 1,
                  key: 'Stage I',
                },
                {
                  doc_count: 1,
                  key: '__missing__',
                },
              ],
            },
          },
        },
      },
    });
  });
  it('reads hits properly', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              hits {
                total
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
    // expect(get(response, `data[${graphqlField}].hits.edges`)).to.eql([]);
    expect(get(response, `data[${graphqlField}].hits.total`)).to.equal(2);
    expect(response.errors).to.be.undefined;
  });
};
