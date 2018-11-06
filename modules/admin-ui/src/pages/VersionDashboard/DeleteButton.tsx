import * as React from 'react';
import { Mutation, MutationFn } from 'react-apollo';
import gql from 'graphql-tag';
import 'react-table/react-table.css';
import Button from 'mineral-ui/Button';
import { DataProxy } from 'apollo-cache';

/*************************
 * The Delete button
 *************************/
export default ({ projectId }: { projectId: string }) => {
  interface IMutationResponse {
    deleteProject: { id: string };
  }

  const DELETE_PROJECT_MUTATION = gql`
    mutation($projectId: String!) {
      deleteProject(id: $projectId) {
        id
      }
    }
  `;

  const updateCache = (
    cache: DataProxy,
    { data }: { data: IMutationResponse },
  ) => {
    const UPDATE_QUERY = gql`
      {
        projects {
          id
        }
      }
    `;
    cache.writeQuery({
      query: UPDATE_QUERY,
      data: {
        projects: data.deleteProject,
      },
    });
  };

  const handleClick = (deleteProject: MutationFn<IMutationResponse>) => () =>
    deleteProject({
      variables: {
        projectId,
      },
    });

  return (
    <Mutation
      mutation={DELETE_PROJECT_MUTATION}
      variables={{ projectId }}
      update={updateCache}
    >
      {(deleteProject, { loading }) => (
        <Button
          variant="danger"
          size="medium"
          onClick={handleClick(deleteProject)}
          disabled={loading}
        >
          delete
        </Button>
      )}
    </Mutation>
  );
};
