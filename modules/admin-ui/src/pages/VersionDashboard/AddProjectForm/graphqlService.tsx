import * as React from 'react';
import gql from 'graphql-tag';
import { Mutation, MutationFn } from 'react-apollo';
import { uniqBy } from 'lodash';
import { ApolloConsumer } from 'react-apollo';
import { pick } from 'lodash';

import { THoc } from 'src/utils';
import {
  RT_IndexConfigImportData,
  INewIndexInput,
  IPropsWithMutation,
  IMutationVariables,
  INewIndexArgs,
  IAggsState,
  IColumnsState,
  IExtendedMapping,
  IMatchboxState,
  RT_AggsState,
  RT_ColumnsState,
} from './types';
import { ApolloClient } from 'apollo-boost';

const saveAggsState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IAggsState): Promise<{}> => {
  const MUTATION = gql`
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
  `;
  return client.mutate({
    mutation: MUTATION,
    variables: {
      projectId,
      graphqlField,
      state: state.map(s => pick(s, ['field', 'active', 'show'])),
    },
  });
};

const saveColumnsState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IColumnsState): Promise<{}> => {
  const MUTATION = gql`
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
  `;
  return client.mutate({
    mutation: MUTATION,
    variables: {
      projectId,
      graphqlField,
      state: {
        ...pick(state, ['type', 'keyField']),
        defaultSorted: state.defaultSorted.map(s => pick(s, ['id', 'desc'])),
        columns: state.columns.map(s =>
          pick(s, [
            'show',
            'type',
            'sortable',
            'canChangeShow',
            'query',
            'jsonPath',
            'id',
            'field',
            'accessor',
          ]),
        ),
      },
    },
  });
};

const saveExtendedMapping = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IExtendedMapping): Promise<{}> => {
  const MUTATION = gql`
    mutation(
      $projectId: String!
      $graphqlField: String!
      $extendedMapping: [ExtendedMappingSetFieldInput]!
    ) {
      saveExtendedMapping(
        projectId: $projectId
        graphqlField: $graphqlField
        input: $extendedMapping
      ) {
        field
      }
    }
  `;
  return await client.mutate({
    mutation: MUTATION,
    variables: {
      projectId,
      graphqlField,
      extendedMapping: state.map(s =>
        pick(s, [
          'field',
          'type',
          'displayName',
          'active',
          'isArray',
          'primaryKey',
          'quickSearchEnabled',
          'unit',
          'displayValues',
          'rangeStep',
        ]),
      ),
    },
  });
};

const saveMatboxState = (client: ApolloClient<{}>) => (
  projectId: string,
  graphqlField: string,
) => async (state: IMatchboxState): Promise<{}> => {
  const MUTATION = gql`
    mutation(
      $projectId: String!
      $graphqlField: String!
      $state: [MatchBoxFieldInput]
    ) {
      saveMatchBoxState(
        projectId: $projectId
        graphqlField: $graphqlField
        state: $state
      ) {
        state {
          field
        }
      }
    }
  `;
  return client.mutate({
    mutation: MUTATION,
    variables: {
      projectId,
      graphqlField,
      state: state.map(s =>
        pick(s, [
          'displayName',
          'field',
          'isActive',
          'keyField',
          'searchFields',
        ]),
      ),
    },
  });
};

/******************
 * Data validators
 ******************/
const validateMutationVariables = async (
  variables: IMutationVariables,
): Promise<void> => {
  const { indexConfigs, projectId } = variables;
  const hasDuplicateIndexName =
    uniqBy(
      indexConfigs,
      (config: typeof indexConfigs[0]) =>
        config.newIndexMutationInput.graphqlField,
    ).length !== indexConfigs.length;
  const missingIndices = !indexConfigs.length;
  const missingProjectId = !projectId.length;
  const missingIndexField = !indexConfigs.reduce(
    (acc, config) =>
      acc &&
      !!config.newIndexMutationInput.projectId.length &&
      !!config.newIndexMutationInput.esIndex.length &&
      !!config.newIndexMutationInput.graphqlField.length,
    true,
  );
  console.log(
    uniqBy(indexConfigs, (config: INewIndexInput) => config.graphqlField),
  );
  console.log(variables);
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
        RT_IndexConfigImportData.check(config);
      } catch (err) {
        console.log('config: ', config);
        try {
          RT_ColumnsState.check(config.columnsState);
          console.log('check passed!!!');
        } catch (err) {
          console.log('err: ', err);
        }
        throw new Error(
          `Invalid files were imported for index "${newIndexMutationInput.graphqlField}"`,
        );
      }
    }
  });
};

/*****
 * Pretty much a monkey patch to ensure legacy data works
 *****/
const sanitizeIndexConfigs = (
  indexConfigs: INewIndexArgs[],
): typeof indexConfigs =>
  indexConfigs.map(i => ({
    ...i,
    config: !i.config
      ? i.config
      : {
          ...i.config,
          columnsState: !i.config.columnsState
            ? i.config.columnsState
            : {
                ...i.config.columnsState,
                type: i.newIndexMutationInput.graphqlField,
                columns: i.config.columnsState.columns.map(c => {
                  [
                    'field',
                    'accessor',
                    'show',
                    'type',
                    'sortable',
                    'canChangeShow',
                    'jsonPath',
                    'query',
                    'id',
                  ].forEach(k => {
                    if (c[k] === undefined) console.log([k]);
                  });
                  return {
                    ...c,
                    jsonPath: c.jsonPath || null,
                    accessor: c.accessor || null,
                    query: c.query || null,
                    id: c.id || null,
                  };
                }),
              },
          extended: (i.config.extended || []).map(obj => ({
            ...obj,
            displayValues: obj.displayValues || {},
          })),
        },
  }));

/******************
 * Provides server mutation to add multiple indices given a project
 ******************/
const ProjectIndicesMutationProvider: React.ComponentType<{
  children: ({
    createNewProjectIndex,
  }: {
    createNewProjectIndex: MutationFn<{}, INewIndexInput>;
  }) => React.ReactNode;
}> = ({ children }) => {
  const MUTATION = gql`
    mutation($projectId: String!, $graphqlField: String!, $esIndex: String!) {
      newIndex(
        projectId: $projectId
        graphqlField: $graphqlField
        esIndex: $esIndex
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

/*****************
 * Provides server transaction to add index
 *****************/
export { IPropsWithMutation } from './types';
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
                  const { indexConfigs: rawIndexConfigs, projectId } = args;

                  const indexConfigs = sanitizeIndexConfigs(rawIndexConfigs);

                  // make sure to keep all validations up top before going ahead with the process
                  await validateProjectConfigData(indexConfigs);
                  await validateMutationVariables(args);

                  /**
                   * starts the project creation process
                   */
                  await createNewProject({
                    variables: {
                      projectId,
                    },
                  });
                  await Promise.all(
                    indexConfigs.map(indexConfig =>
                      createNewProjectIndex({
                        variables: indexConfig.newIndexMutationInput,
                      }),
                    ),
                  );
                  // index creations can happen in parallel
                  await Promise.all(
                    indexConfigs.map(async indexConfig => {
                      const { config } = indexConfig;
                      if (config) {
                        const {
                          aggsState,
                          columnsState,
                          matchboxState,
                          extended,
                        } = config;

                        return Promise.all(
                          [
                            aggsState,
                            columnsState,
                            matchboxState,
                            extended,
                          ].map(async metadata => {
                            if (aggsState && metadata === aggsState) {
                              return saveAggsState(client)(
                                projectId,
                                indexConfig.newIndexMutationInput.graphqlField,
                              )(aggsState);
                            }
                            if (columnsState && metadata === columnsState) {
                              return saveColumnsState(client)(
                                projectId,
                                indexConfig.newIndexMutationInput.graphqlField,
                              )(columnsState);
                            }
                            if (matchboxState && metadata === matchboxState) {
                              return saveMatboxState(client)(
                                projectId,
                                indexConfig.newIndexMutationInput.graphqlField,
                              )(matchboxState);
                            }
                            if (extended && metadata === extended) {
                              return saveExtendedMapping(client)(
                                projectId,
                                indexConfig.newIndexMutationInput.graphqlField,
                              )(extended);
                            }
                            return null;
                          }),
                        );
                      }
                      return null;
                    }),
                  );
                  return;
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
