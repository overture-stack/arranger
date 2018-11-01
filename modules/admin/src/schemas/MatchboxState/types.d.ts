export interface I_MatchBoxField {
  displayName: string;
  field: string;
  isActive: boolean;
  keyField: string;
  searchFields: string[];
}

export interface I_MatchBoxState {
  timestamp: string;
  state: I_MatchBoxField[];
}

export interface I_MatchBoxFieldInput {
  displayName: string;
  field: string;
  isActive: boolean;
  keyField: string;
  searchFields: string[];
}

export interface I_SaveMatchBoxStateMutationInput {
  projectId: string;
  graphqlField: string;
  state: I_MatchBoxFieldInput[];
}

export interface I_MatchBoxStateQueryInput {
  projectId: string;
  graphqlField: string;
}
