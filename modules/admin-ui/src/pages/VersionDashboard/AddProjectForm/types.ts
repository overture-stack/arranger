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
  indexConfigs: INewIndexInput[];
}
export interface IPropsWithMutation {
  // addProject: MutationFn<IMutationResponseData, IMutationVariables>;
  addProject: (args: IMutationVariables) => Promise<void>;
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
export interface ILayoutProps extends IInjectedProps, IExternalProps {}
