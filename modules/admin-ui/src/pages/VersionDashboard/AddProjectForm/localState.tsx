import * as React from 'react';
import Component from 'react-component-component';

import { THoc } from 'src/utils';
import {
  INewIndexInput,
  INewIndexArgs,
  ILocalFormState,
  ILocalFormMutations,
  IFormStateProps,
  IProjectIndexConfig,
} from './types';

/******************
 * provides local form state
 ******************/
const withLocalFormState: THoc<{}, IFormStateProps> = Wrapped => props => {
  const initialState: ILocalFormState = {
    projectId: '',
    indices: [],
    error: null,
    isloading: false,
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
              indices: state.indices.map(i => ({
                ...i,
                newIndexMutationInput: {
                  ...i.newIndexMutationInput,
                  projectId: id,
                },
              })),
            });
          },
          addIndex: (indexConfig: INewIndexArgs) => {
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
          setIndexMutationInput: (indexPosition: number) => (
            config: INewIndexInput,
          ) => {
            setState({
              ...state,
              indices: state.indices.map(
                (args, i): typeof args =>
                  i !== indexPosition
                    ? args
                    : {
                        ...args,
                        newIndexMutationInput: config,
                      },
              ),
            });
          },
          setIndexConfig: (indexPosition: number) => (
            indexConfig: IProjectIndexConfig | null,
          ) => {
            setState({
              ...state,
              indices: state.indices.map(
                (args, i): typeof args =>
                  i !== indexPosition
                    ? args
                    : {
                        ...args,
                        config: indexConfig,
                      },
              ),
            });
          },
          setError: error => {
            setState({ ...state, error });
            return new Promise(resolve => {
              setTimeout(() => {
                setState({ ...state, error: null });
                resolve(error);
              }, 5000);
            });
          },
          setLoadingState: isLoading =>
            setState({ ...state, isloading: isLoading }),
        };
        const childrenProps: IFormStateProps = {
          formState: { state, mutations: mutations },
        };
        return <Wrapped {...{ ...props, ...childrenProps }} />;
      }}
    </Component>
  );
};

export default withLocalFormState;
