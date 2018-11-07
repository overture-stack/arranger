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

/*****************
 * Provides server mutation to add indices
 *****************/
// const withIndexAddmutation: THoc<
//   {},
//   I
// >

/*****************
 * Provides server mutation to add index
 *****************/
const withAddProjectMutation: THoc<
  {},
  IPropsWithMutation
> = Wrapped => props => {
  const ADD_PROJECT_MUTATION = gql`
    mutation($projectId: String!) {
      newProject(id: $projectId) {
        id
      }
    }
  `;
  const ADD_PROJECT_INDEX_MUTATION = gql`
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
    <Mutation mutation={ADD_PROJECT_MUTATION} update={updateCache}>
      {createNewProject => (
        <Mutation mutation={ADD_PROJECT_INDEX_MUTATION}>
          {createNewProjectIndex => {
            const addProject: MutationFn<
              IMutationResponseData,
              IMutationVariables
            > = createNewProject;
            // const addProject = (args: IMutationVariables) => {
            //   return createNewProject({variables: args});
            // };
            return <Wrapped addProject={addProject} {...props} />;
          }}
        </Mutation>
      )}
    </Mutation>
  );
};

export default compose<{}, IExternalProps>(
  withLocalFormState,
  withAddProjectMutation,
)(Layout);
