import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';

export default ({ api, graphqlField, gqlPath }) => {
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
  it('paginates hits properly', async () => {
    expect(
      await await api.post({
        endpoint: gqlPath,
        body: {
          query: print(gql`
          {
            ${graphqlField} {
              hits (first: 1, offset: 0) {
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
      }),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              {
                node: {
                  id: '5da62fbad545d210fe1c63a9',
                },
              },
            ],
          },
        },
      },
    });

    expect(
      await await api.post({
        endpoint: gqlPath,
        body: {
          query: print(gql`
          {
            ${graphqlField} {
              hits (first: 1, offset: 1) {
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
      }),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              {
                node: {
                  id: '5dc9b6c3d614630f9809f7d0',
                },
              },
            ],
          },
        },
      },
    });

    expect(
      await await api.post({
        endpoint: gqlPath,
        body: {
          query: print(gql`
          {
            ${graphqlField} {
              hits (first: 2, offset: 0) {
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
      }),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              {
                node: {
                  id: '5da62fbad545d210fe1c63a9',
                },
              },
              {
                node: {
                  id: '5dc9b6c3d614630f9809f7d0',
                },
              },
            ],
          },
        },
      },
    });

    expect(
      await await api.post({
        endpoint: gqlPath,
        body: {
          query: print(gql`
          {
            ${graphqlField} {
              hits (first: 2, offset: 1) {
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
      }),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              {
                node: {
                  id: '5dc9b6c3d614630f9809f7d0',
                },
              },
            ],
          },
        },
      },
    });
  });
};
