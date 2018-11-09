import {
  Boolean,
  String,
  Array as RT_Array,
  Record,
  Union,
  Dictionary,
  Static,
  Undefined,
  Null,
} from 'runtypes';

export const RT_IndexConfigImportDataRunType = Record({
  aggsState: Union(
    Undefined,
    RT_Array(
      Record({
        active: Boolean,
        field: String,
        show: Boolean,
      }),
    ),
  ),
  columnsState: Union(
    Undefined,
    Record({
      type: String,
      keyField: String,
      defaultSorted: RT_Array(Record({ id: String, desc: Boolean })),
      columns: RT_Array(
        Record({
          accessor: String,
          canChangeShow: Boolean,
          field: String,
          jsonPath: Union(Null, String),
          query: Union(Null, String),
          show: Boolean,
          sortable: Boolean,
          type: String,
        }),
      ),
    }),
  ),
  extended: Union(
    Undefined,
    RT_Array(
      Record({
        active: Boolean,
        displayName: String,
        displayValues: Dictionary(String, 'string'),
        field: String,
        isArray: Boolean,
        primaryKey: Boolean,
        quickSearchEnabled: Boolean,
        type: String,
        unit: Union(Null, String),
      }),
    ),
  ),
  matchboxState: Union(
    Undefined,
    RT_Array(
      Record({
        displayName: String,
        field: String,
        isActive: Boolean,
        keyField: String,
        searchFields: RT_Array(String),
      }),
    ),
  ),
});

export interface Something {
  accessor: string;
  canChangeShow: boolean;
  field: string;
  jsonPath: null | string;
  query: null | string;
  show: boolean;
  sortable: boolean;
  type: string;
}
[];

/****************
 * Index data import struct
 ****************/
export interface IIndexConfigImportData
  extends Static<typeof RT_IndexConfigImportDataRunType> {}

/********
 * Local state types
 ********/
export interface IProjectIndexConfig extends IIndexConfigImportData {}
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

/*******
 * layout component Types
 *******/
export interface IInjectedProps extends IFormStateProps, IPropsWithMutation {}
export interface IExternalProps {
  onCancel: () => void;
}
export interface ILayoutProps extends IInjectedProps, IExternalProps {}
