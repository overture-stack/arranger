import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';
import orderBy from 'lodash/orderBy';

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
  it('reads aggregations with sqon properly', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "in",
                      content: {
                        field: "clinical_diagnosis.clinical_stage_grouping",
                        value: "Stage I"
                      }
                    }
                  ]
                }, 
                aggregations_filter_themselves: true
              ) {
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
    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: orderBy(
                response.data[graphqlField].aggregations
                  .clinical_diagnosis__clinical_stage_grouping.buckets,
                'key',
              ),
            },
          },
        },
      },
    }).to.eql({
      data: {
        model: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 1,
                  key: 'Stage I',
                },
              ],
            },
          },
        },
      },
    });
  });
  it('reads hits with sqon properly', async () => {
    let response = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              hits(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "in",
                      content: {
                        field: "clinical_diagnosis.clinical_stage_grouping",
                        value: "Stage I"
                      }
                    }
                  ]
                }
              ) {
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
            total: 1,
            edges: [{ node: { id: '5da62fbad545d210fe1c63a9' } }],
          },
        },
      },
    });
  });
};
