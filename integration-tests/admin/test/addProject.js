import { expect } from 'chai';
import gql from 'graphql-tag';
import { print } from 'graphql';

export default ({ api, adminPath }) => {
  const projectId = 'test';
  const graphqlField = 'file';
  const esIndex = 'file_centric';
  it('creates projects properly', async () => {
    let response = await api.post({
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
    expect(response.errors).to.be.undefined;
  });
  it(`registers indices successfully`, async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation(
            $projectId: String!
            $graphqlField: String!
            $esIndex: String!
          ) {
            newIndex(
              projectId: $projectId
              graphqlField: $graphqlField
              esIndex: $esIndex
            ) {
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
  it('creates aggs state', async () => {
    let response = await api.post({
      endpoint: adminPath,
      body: {
        query: print(gql`
          mutation(
            $projectId: String!
            $graphqlField: String!
            $state: [AggStateInput]!
          ) {
            saveAggsState(
              projectId: $projectId
              graphqlField: $graphqlField
              state: $state
            ) {
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
          mutation(
            $projectId: String!
            $graphqlField: String!
            $state: ColumnStateInput!
          ) {
            saveColumnsState(
              projectId: $projectId
              graphqlField: $graphqlField
              state: $state
            ) {
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
            keyField: 'asdf',
          },
        },
      },
    });
    expect(response.errors).to.be.undefined;
  });
};
