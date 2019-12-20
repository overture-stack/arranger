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
    expect(response).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              { node: { id: '5da62fbad545d210fe1c63a9' } },
              { node: { id: '5dc9b6c3d614630f9809f7d0' } },
            ],
          },
        },
      },
    });
  });
};
