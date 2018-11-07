import * as React from 'react';
import Component from 'react-component-component';
import gql from 'graphql-tag';
import { compose } from 'recompose';
import { Mutation, MutationFn } from 'react-apollo';
import { DataProxy } from 'apollo-cache';

import { THoc } from 'src/utils';
import Layout from './layout';
import {
  INewIndexInput,
  ILocalFormState,
  ILocalFormMutations,
  IFormStateProps,
  IMutationResponseData,
  IPropsWithMutation,
  IExternalProps,
  IMutationVariables,
} from './types';

/******************
 * provides local form state
 ******************/
const withLocalFormState: THoc<{}, IFormStateProps> = Wrapped => props => {
  const initialState: ILocalFormState = {
    projectId: '',
    indices: [],
  };
  return (
    <Component initialState={initialState}>
      {({
        state,
        setState,
      }: {
        state: ILocalFormState;
        setState: (s: ILocalFormState) => void;
      }) => {
        const mutations: ILocalFormMutations = {
          setProjectId: id => {
            setState({
              ...state,
              projectId: id,
            });
          },
          addIndex: (indexConfig: INewIndexInput) => {
            setState({
              ...state,
              indices: state.indices.concat(indexConfig),
            });
          },
          removeIndex: (indexPosition: number) => {
            setState({
              ...state,
              indices: state.indices.filter((x, i) => i !== indexPosition),
            });
          },
          setIndexConfig: (indexPosition: number) => (
            config: INewIndexInput,
          ) => {
            setState({
              ...state,
              indices: state.indices.map(
                (_config, i) =>
                  i !== indexPosition
                    ? _config
                    : {
                        ...config,
                        graphqlField: config.graphqlField.split('-').join('_'),
                      },
              ),
            });
          },
        };
        const childrenProps: IFormStateProps = {
          formState: { state, mutations: mutations },
        };
        return <Wrapped {...{ ...props, ...childrenProps }} />;
      }}
    </Component>
  );
};

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
  const updateCache = (
    cache: DataProxy,
    response: { data: IMutationResponseData },
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
      data: { projects: response.data.newProject },
    });
  };
  return (
    <Mutation mutation={NEW_PROJECT_MUTATION} update={updateCache}>
      {createNewProject => {
        return (
          <ProjectIndicesMutationProvider>
            {({ createNewProjectIndex }: { createNewProjectIndex: any }) => {
              const addProject = async (args: IMutationVariables) => {
                await createNewProject({
                  variables: {
                    projectId: args.projectId,
                  },
                });
                args.indexConfigs.forEach(async indexConfig => {
                  await createNewProjectIndex({
                    variables: indexConfig,
                  });
                });
              };
              return <Wrapped addProject={addProject} {...props} />;
            }}
          </ProjectIndicesMutationProvider>
        );
      }}
    </Mutation>
  );
};

export default compose<{}, IExternalProps>(
  withLocalFormState,
  withAddProjectMutation,
)(Layout);
