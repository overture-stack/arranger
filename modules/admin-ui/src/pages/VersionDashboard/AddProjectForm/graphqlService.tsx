import * as React from 'react';
import gql from 'graphql-tag';
import { Mutation, MutationFn } from 'react-apollo';
import { uniqBy } from 'lodash';
import { ApolloConsumer } from 'react-apollo';

import { THoc } from 'src/utils';
import {
  RT_IndexConfigImportDataRunType,
  INewIndexInput,
  IPropsWithMutation,
  IMutationVariables,
  INewIndexArgs,
  IAggsState,
  IColumnsState,
  IExtendedMapping,
  IMatchboxState,
} from './types';
import { ApolloClient } from 'apollo-boost';

/******************
 * Provides server mutation to add multiple indices given a project
 ******************/
const ProjectIndicesMutationProvider: React.ComponentType<{
  children: (
    {
      createNewProjectIndex,
    }: { createNewProjectIndex: MutationFn<{}, INewIndexInput> },
  ) => React.ReactNode;
}> = ({ children }) => {
  const MUTATION = gql`
    mutation(
      $projectId: String!
      $graphqlField: String!
      $esIndex: String!
      $esType: String!
    ) {
      newIndex(
        projectId: $projectId
        graphqlField: $graphqlField
        esIndex: $esIndex
        esType: $esType
      ) {
        id
      }
    }
  `;
  return (
    <Mutation mutation={MUTATION}>
      {(applyMutation: MutationFn<{}, INewIndexInput>) =>
        children({ createNewProjectIndex: applyMutation })
      }
    </Mutation>
  );
};

const saveAggsState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IAggsState): Promise<{}> => {
  return {};
};
const saveColumnsState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IColumnsState): Promise<{}> => {
  return {};
};
const saveExtendedMapping = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IExtendedMapping): Promise<{}> => {
  return {};
};
const saveMatboxState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IMatchboxState): Promise<{}> => {
  return {};
};

/******************
 * Data validators
 ******************/
const validateMutationVariables = async (
  variables: IMutationVariables,
): Promise<void> => {
  const hasDuplicateIndexName =
    uniqBy(
      variables.indexConfigs,
      (config: INewIndexInput) => config.graphqlField,
    ).length !== variables.indexConfigs.length;
  const missingIndices = !variables.indexConfigs.length;
  const missingProjectId = !variables.projectId.length;
  const missingIndexField = !variables.indexConfigs.reduce(
    (acc, config) =>
      acc &&
      !!config.newIndexMutationInput.projectId.length &&
      !!config.newIndexMutationInput.esIndex.length &&
      !!config.newIndexMutationInput.esType.length &&
      !!config.newIndexMutationInput.graphqlField.length,
    true,
  );
  if (hasDuplicateIndexName) {
    throw new Error(
      'Cannot use multiple indices with the same name (aka graphqlField)',
    );
  }
  if (missingIndices) {
    throw new Error('Cannot create project with no index');
  }
  if (missingProjectId) {
    throw new Error('Project ID missing');
  }
  if (missingIndexField) {
    throw new Error('Some fields in the indices are missing');
  }
};

const validateProjectConfigData = (indexConfigs: INewIndexArgs[]) => {
  indexConfigs.forEach(indexConfig => {
    if (indexConfig.config) {
      const { config, newIndexMutationInput } = indexConfig;
      try {
        RT_IndexConfigImportDataRunType.check(config);
      } catch (err) {
        throw new Error(
          `Invalid files were imported for index "${
            newIndexMutationInput.graphqlField
          }"`,
        );
      }
    }
  });
};

/*****************
 * Provides server transaction to add index
 *****************/
const withAddProjectMutation: THoc<
  {},
  IPropsWithMutation
> = Wrapped => props => {
  const NEW_PROJECT_MUTATION = gql`
    mutation($projectId: String!) {
      newProject(id: $projectId) {
        id
      }
    }
  `;
  return (
    <ApolloConsumer>
      {client => (
        <Mutation mutation={NEW_PROJECT_MUTATION}>
          {createNewProject => (
            <ProjectIndicesMutationProvider>
              {({ createNewProjectIndex }: { createNewProjectIndex: any }) => {
                const addProject = async (args: IMutationVariables) => {
                  const { indexConfigs, projectId } = args;
                  // make sure to keep all validations up top before going ahead with the process
                  await validateProjectConfigData(indexConfigs);
                  await validateMutationVariables(args);

                  // starting the process
                  await createNewProject({
                    variables: {
                      projectId,
                    },
                  });
                  indexConfigs.forEach(async indexConfig => {
                    const { config } = indexConfig;
                    await createNewProjectIndex({
                      variables: indexConfig.newIndexMutationInput,
                    });
                    if (config) {
                      const {
                        aggsState,
                        columnsState,
                        matchboxState,
                        extended,
                      } = config;
                      const configPromises: Array<Promise<{}>> = [];
                      if (aggsState) {
                        configPromises.push(
                          saveAggsState(client)(
                            projectId,
                            indexConfig.newIndexMutationInput.graphqlField,
                          )(aggsState),
                        );
                      }
                      if (columnsState) {
                        configPromises.push(
                          saveColumnsState(client)(
                            projectId,
                            indexConfig.newIndexMutationInput.graphqlField,
                          )(columnsState),
                        );
                      }
                      if (matchboxState) {
                        configPromises.push(
                          saveMatboxState(client)(
                            projectId,
                            indexConfig.newIndexMutationInput.graphqlField,
                          )(matchboxState),
                        );
                      }
                      if (extended) {
                        configPromises.push(
                          saveExtendedMapping(client)(
                            projectId,
                            indexConfig.newIndexMutationInput.graphqlField,
                          )(extended),
                        );
                      }
                      await configPromises;
                    }
                  });
                };
                return <Wrapped addProject={addProject} {...props} />;
              }}
            </ProjectIndicesMutationProvider>
          )}
        </Mutation>
      )}
    </ApolloConsumer>
  );
};

export default withAddProjectMutation;
