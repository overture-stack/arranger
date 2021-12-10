/***************/
/* input types */
/***************/
export interface I_ColumnStateQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface I_SaveColumnsStateMutationInput {
  projectId: string;
  graphqlField: string;
  state: I_ColumnStateInput;
}

export interface I_ColumnStateInput {
  type: string;
  keyField: string;
  defaultSorted: [I_ColumnSort];
  columns: I_Column[];
}

export interface I_ColumnSortInput {
  id: string;
  desc: boolean;
}

export interface I_ColumnInput {
  show: boolean;
  type: string;
  sortable: boolean;
  canChangeShow: boolean;
  query: string;
  jsonPath: string;
  id: string;
  field: string;
  accessor: string;
}

/****************/
/* output types */
/****************/
export interface I_Column {
  show: boolean;
  type: string;
  sortable: boolean;
  canChangeShow: boolean;
  query: string;
  jsonPath: string;
  id: string;
  field: string;
  accessor: string;
}

export interface I_ColumnSort {
  id: string;
  desc: boolean;
}

export interface I_ColumnState {
  type: string;
  keyField: string;
  defaultSorted: I_ColumnSort[];
  columns: I_Column[];
}

export interface I_ColumnSetState {
  state: I_ColumnState;
  timestamp: string;
}
