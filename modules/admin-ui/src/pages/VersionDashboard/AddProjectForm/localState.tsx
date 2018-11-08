import * as React from 'react';
import Component from 'react-component-component';

import { THoc } from 'src/utils';
import {
  INewIndexInput,
  ILocalFormState,
  ILocalFormMutations,
  IFormStateProps,
} from './types';

/******************
 * provides local form state
 ******************/
const withLocalFormState: THoc<{}, IFormStateProps> = Wrapped => props => {
  const initialState: ILocalFormState = {
    projectId: '',
    indices: [],
    error: null,
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
          setError: error => {
            setState({ ...state, error });
            return new Promise(resolve => {
              setTimeout(() => {
                setState({ ...state, error: null });
                resolve(error);
              }, 3000);
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

export default withLocalFormState;
