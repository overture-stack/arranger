import { MutationFn } from 'react-apollo';

/********
 * Server data types
 ********/
export interface INewIndexInput {
  projectId: string;
  graphqlField: string;
  esIndex: string;
  esType: string;
}
export interface IMutationResponseData {
  newProject: {
    id: string;
  }[];
}
export interface IMutationVariables {
  projectId: string;
  indexConfig: INewIndexInput[];
}
export interface IPropsWithMutation {
  addProject: MutationFn<IMutationResponseData, IMutationVariables>;
}

/********
 * Local state types
 ********/
export interface ILocalFormState {
  projectId: string;
  indices: INewIndexInput[];
}
export interface ILocalFormMutations {
  setProjectId: (id: string) => void;
  addIndex: (indexConfig: INewIndexInput) => void;
  removeIndex: (indexPosition: number) => void;
  setIndexConfig: (
    indexPosition: number,
  ) => (indexConfig: INewIndexInput) => void;
}
export interface IFormStateProps {
  formState: {
    state: ILocalFormState;
    mutations: ILocalFormMutations;
  };
}

/*******
 * layout component Types
 *******/
export interface IInjectedProps extends IFormStateProps, IPropsWithMutation {}
export interface IExternalProps {
  onCancel: () => void;
}
export interface IRenderableProps extends IInjectedProps, IExternalProps {}
