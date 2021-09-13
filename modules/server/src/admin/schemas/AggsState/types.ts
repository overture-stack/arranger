/***************/
/* input types */
/***************/
export interface I_AggsStateQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface I_SaveAggsStateMutationInput {
  projectId: string;
  graphqlField: string;
  state: I_AggsStateInput[];
}

export interface I_AggsStateInput {
  field: string;
  active: boolean;
  show: boolean;
}

/****************/
/* output types */
/****************/
export interface I_AggsSetState {
  timestamp: string;
  state: I_AggsState[];
}

export interface I_AggsState {
  field: string;
  active: boolean;
  show: boolean;
  type: string;
}
