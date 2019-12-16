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
  Number,
} from 'runtypes';

/****************
 * Index data import struct, using runtypes for runtime type validation
 ****************/
export const RT_Column = Record({
  field: String,
  accessor: Union(Undefined, Union(Null, String)),
  show: Boolean,
  type: String,
  sortable: Boolean,
  canChangeShow: Boolean,
  jsonPath: Union(Undefined, Union(Null, String)),
  query: Union(Undefined, Union(Null, String)),
  id: Union(Null, String),
});

export const RT_ColumnsState = Record({
  type: String,
  keyField: String,
  defaultSorted: RT_Array(Record({ id: String, desc: Boolean })),
  columns: RT_Array(RT_Column),
});

export const RT_AggsStateEntry = Record({
  active: Boolean,
  field: String,
  show: Boolean,
});

export const RT_AggsState = RT_Array(RT_AggsStateEntry);

const RT_ExtendedMappingField = Record({
  active: Boolean,
  displayName: String,
  displayValues: Dictionary(String, 'string'),
  field: String,
  isArray: Boolean,
  primaryKey: Boolean,
  quickSearchEnabled: Boolean,
  type: String,
  unit: Union(Null, String),
  rangeStep: Union(Null, Union(Undefined, Number)),
});

export const RT_ExtendedMapping = RT_Array(RT_ExtendedMappingField);

export const RT_Matchbox = Record({
  displayName: String,
  field: String,
  isActive: Boolean,
  keyField: Union(Null, String),
  searchFields: RT_Array(String),
});

export const RT_MatchboxState = RT_Array(RT_Matchbox);

export const RT_IndexConfigImportData = Record({
  aggsState: Union(Undefined, RT_AggsState),
  columnsState: Union(Undefined, RT_ColumnsState),
  extended: Union(Undefined, RT_ExtendedMapping),
  matchboxState: Union(Undefined, RT_MatchboxState),
});

export interface IIndexConfigImportData
  extends Static<typeof RT_IndexConfigImportData> {}
export interface IAggsStateEntry extends Static<typeof RT_AggsStateEntry> {}
export interface IAggsState extends Static<typeof RT_AggsState> {}
export interface IColumnsState extends Static<typeof RT_ColumnsState> {}
export interface IExtendedMapping extends Static<typeof RT_ExtendedMapping> {}
export interface IExtendedMappingField
  extends Static<typeof RT_ExtendedMappingField> {}
export interface IMatchboxState extends Static<typeof RT_MatchboxState> {}

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
  isloading: boolean;
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
  setLoadingState: (isLoading: boolean) => void;
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
  onProjectAdded: (...any) => any;
  onCancel: () => void;
}
export interface ILayoutProps extends IInjectedProps, IExternalProps {}
