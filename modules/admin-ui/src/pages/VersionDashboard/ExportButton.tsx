import * as React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

import Button from 'mineral-ui/Button';
const ALL_DATA_QUERY = gql`
  query($projectId: String!) {
    project(id: $projectId) {
      id
      indices {
        id
        hasMapping
        graphqlField
        projectId
        esIndex
        esType

        extended {
          gqlId
          field
          type
          displayName
          active
          isArray
          primaryKey
          quickSearchEnabled
          unit
          displayValues
          rangeStep
        }
        aggsState {
          timestamp
          state {
            field
            active
            show
          }
        }
        columnsState {
          ... on ColumnsState {
            timestamp
            state {
              type
              keyField
              defaultSorted {
                id
                desc
              }
              columns {
                show
                type
                sortable
                canChangeShow
                query
                jsonPath
                id
                field
                accessor
              }
            }
          }
        }
        matchBoxState {
          timestamp
          state {
            displayName
            field
            isActive
            keyField
            searchFields
          }
        }
      }
    }
  }
`;

const download = (content, fileName, contentType) => {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
};

const ExportButton: React.ComponentType<{ projectId: string }> = ({
  projectId,
}) => {
  return (
    <Query
      query={ALL_DATA_QUERY}
      variables={{ projectId }}
      fetchPolicy={'no-cache'}
    >
      {({ data, loading, error }) => {
        const onClick = () =>
          download(
            JSON.stringify(data, null, 2),
            `arranger_project_${projectId}.json`,
            'text/plain',
          );
        return (
          <Button size="medium" disabled={loading || error} onClick={onClick}>
            {loading ? 'LOADING...' : 'Export'}
          </Button>
        );
      }}
    </Query>
  );
};

{
  /* <Component initialState={{ loading: false }}>
  {({ state: { loading }, setState }) => (
    <ApolloConsumer>
      {client => {
        const onClick = (client: ApolloClient<{}>) => async () => {
          setState({ loading: true });
          const { data } = await client.query({
            query: ALL_DATA_QUERY,
            variables: { projectId },
          });
          download(
            JSON.stringify(data, null, 2),
            `arranger_project_${projectId}.json`,
            'text/plain',
          );
          setState({ loading: false });
        };
        return (
          <Button
            disabled={loading}
            size="medium"
            onClick={onClick(client)}
          >
            {loading ? 'LOADING...' : 'Export'}
          </Button>
        );
      }}
    </ApolloConsumer>
  )}
</Component> */
}

export default ExportButton;
