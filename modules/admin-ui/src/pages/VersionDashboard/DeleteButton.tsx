import * as React from 'react';
import { Mutation, MutationFn } from 'react-apollo';
import gql from 'graphql-tag';
import 'react-table/react-table.css';
import Button from 'mineral-ui/Button';

/*************************
 * The Delete button
 *************************/
export default ({
  projectId,
  onProjectRemoved,
}: {
  projectId: string;
  onProjectRemoved: () => void;
}) => {
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

  const handleClick = (deleteProject: MutationFn<IMutationResponse>) => () =>
    deleteProject({
      variables: {
        projectId,
      },
    }).then(() => onProjectRemoved());

  return (
    <Mutation mutation={DELETE_PROJECT_MUTATION}>
      {(deleteProject, { loading }) => (
        <Button
          variant="danger"
          size="medium"
          onClick={handleClick(deleteProject)}
          disabled={loading}
        >
          Delete
        </Button>
      )}
    </Mutation>
  );
};
