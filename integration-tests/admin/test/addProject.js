import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';

export default ({ api, adminPath, esIndex }) => {
  const projectId = 'test';
  const graphqlField = 'file';
  const keyField = 'kf_id';
  it('creates projects properly', async () => {
    let { errors } = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: String!) {
            newProject(id: $projectId) {
              id
              __typename
            }
          }
        `),
        variables: {
          projectId,
        },
      },
    });
    expect(errors).to.be.undefined;

    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          {
            projects {
              id
            }
          }
        `),
      },
    });
    expect(response.data.projects.map(({ id }) => id)).to.contain(projectId);
  });
  it(`registers indices successfully`, async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: String!, $graphqlField: String!, $esIndex: String!) {
            newIndex(projectId: $projectId, graphqlField: $graphqlField, esIndex: $esIndex) {
              id
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
          esIndex,
        },
      },
    });
    expect(response.errors).to.be.undefined;
  });
  it(`reads indices successfully`, async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          query($projectId: ID!, $graphqlField: String!) {
            index(projectId: $projectId, graphqlField: $graphqlField) {
              projectId
              esIndex
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
        },
      },
    });
    expect(response.errors).to.be.undefined;
    expect(response.data.index.projectId).to.equal(projectId);
    expect(response.data.index.esIndex).to.equal(esIndex);
  });
  it('creates aggs state', async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: String!, $graphqlField: String!, $state: [AggStateInput]!) {
            saveAggsState(projectId: $projectId, graphqlField: $graphqlField, state: $state) {
              state {
                field
              }
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
          state: [],
        },
      },
    });
    expect(response.errors).to.be.undefined;
  });
  it('creates columns state', async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: String!, $graphqlField: String!, $state: ColumnStateInput!) {
            saveColumnsState(projectId: $projectId, graphqlField: $graphqlField, state: $state) {
              ... on ColumnsState {
                timestamp
              }
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
          state: {
            type: graphqlField,
            keyField: keyField,
            defaultSorted: [],
            columns: [],
          },
        },
      },
    });
    expect(response.errors).to.be.undefined;
  });
  it('reads projects properly', async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          {
            projects {
              id
              indices {
                id
                graphqlField
                extended {
                  field
                }
                aggsState {
                  state {
                    field
                  }
                }
                columnsState {
                  ... on ColumnsState {
                    state {
                      columns {
                        field
                      }
                    }
                  }
                }
                matchBoxState {
                  state {
                    field
                  }
                }
              }
            }
          }
        `),
      },
    });
    expect(response.errors).to.be.undefined;
    const projectWithId = response.data.projects.find(({ id }) => id === projectId);
    const projectIndex = projectWithId.indices.find(
      ({ graphqlField: _graphqlField }) => _graphqlField === graphqlField,
    );
    expect(projectWithId).to.be.not.empty;
    expect(projectIndex).to.be.not.empty;
    expect(projectIndex.extended).to.be.not.empty;
    expect(projectIndex.aggsState.state).to.be.not.empty;
    expect(projectIndex.columnsState.state).to.be.not.empty;
    expect(projectIndex.matchBoxState.state).to.be.not.empty;
  });
  it('removes index properly', async () => {
    await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: ID!, $graphqlField: String!) {
            deleteIndex(projectId: $projectId, graphqlField: $graphqlField) {
              id
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
        },
      },
    });
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          query($projectId: ID!, $graphqlField: String!) {
            index(projectId: $projectId, graphqlField: $graphqlField) {
              projectId
              esIndex
            }
          }
        `),
        variables: {
          projectId,
          graphqlField,
        },
      },
    });
    expect(response.errors).to.be.undefined;
    expect(response.data.index).to.be.null;
  });
  it('removes project properly', async () => {
    await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation($projectId: String!) {
            deleteProject(id: $projectId) {
              id
            }
          }
        `),
        variables: {
          projectId,
        },
      },
    });
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          {
            projects {
              id
            }
          }
        `),
      },
    });
    expect(response.errors).to.be.undefined;
    expect(response.data.projects.map(({ id }) => id)).to.be.empty;
  });
};
