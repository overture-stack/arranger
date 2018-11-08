/********
 * Server data types
 ********/
export interface INewIndexInput {
  // TODO: this should be imported from '@arranger/admin
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
  indexConfigs: INewIndexArgs[];
}
export interface IPropsWithMutation {
  addProject: (args: IMutationVariables) => Promise<void>;
}

/********
 * Local state types
 ********/
export interface IProjectIndexConfig {}
export interface INewIndexArgs {
  newIndexMutationInput: INewIndexInput;
  config: IProjectIndexConfig | null;
}
export interface ILocalFormState {
  projectId: string;
  indices: INewIndexArgs[];
  error: Error | null;
}
export interface ILocalFormMutations {
  setProjectId: (id: string) => void;
  addIndex: (indexConfig: INewIndexArgs) => void;
  removeIndex: (indexPosition: number) => void;
  setIndexMutationInput: (
    indexPosition: number,
  ) => (mutationInput: INewIndexInput) => void;
  setIndexConfig: (
    indexPosition: number,
  ) => (indexConfig: IProjectIndexConfig | null) => void;
  setError: (error: Error) => Promise<Error>;
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
export interface ILayoutProps extends IInjectedProps, IExternalProps {}
