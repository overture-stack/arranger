import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, documentType, gqlPath }) => {
  it('reads hits with sqon properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
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

    expect(data).to.eql({
      data: {
        model: {
          hits: {
            total: 2,
            edges: [
              { node: { id: 'sagsdhertdfdgsdfgsdfg' } },
              { node: { id: '5da62fbad545d210fe1c63a9' } },
            ],
          },
        },
      },
    });
  });

  it('paginates hits properly', async () => {
    expect(
      await api
        .post({
          endpoint: gqlPath,
          body: {
            query: print(gql`
            {
              ${documentType} {
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
        })
        .then(({ data } = { data: '' }) => data),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 3,
            edges: [
              {
                node: {
                  id: 'sagsdhertdfdgsdfgsdfg',
                },
              },
            ],
          },
        },
      },
    });

    expect(
      await api
        .post({
          endpoint: gqlPath,
          body: {
            query: print(gql`
            {
              ${documentType} {
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
        })
        .then(({ data } = { data: '' }) => data),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 3,
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
      await api
        .post({
          endpoint: gqlPath,
          body: {
            query: print(gql`
            {
              ${documentType} {
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
        })
        .then(({ data } = { data: '' }) => data),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 3,
            edges: [
              {
                node: {
                  id: 'sagsdhertdfdgsdfgsdfg',
                },
              },
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
      await api
        .post({
          endpoint: gqlPath,
          body: {
            query: print(gql`
            {
              ${documentType} {
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
        })
        .then(({ data } = { data: '' }) => data),
    ).to.eql({
      data: {
        model: {
          hits: {
            total: 3,
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
  });

  it('excludes access_denied files', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              hits(first: 1000) {
                edges {
                  node {
                    access_denied
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.model?.hits?.edges?.every((edge) => !edge.node.access_denied)).to.eql(true);
  });

  it('cannot request for access_denied item', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        variables: {
          sqon: {
            op: 'and',
            content: [
              {
                op: 'in',
                content: {
                  field: 'access_denied',
                  value: ['true'],
                },
              },
            ],
          },
        },
        query: print(gql`
          query ($sqon: JSON) {
            ${documentType} {
              hits(first: 1000, filters: $sqon) {
                edges {
                  node {
                    access_denied
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.model?.hits?.edges?.length).to.eql(0);
  });
};
