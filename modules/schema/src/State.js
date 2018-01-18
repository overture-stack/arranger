export let typeDefs = `
  type AggState {
    field: String
    type: String
    displayName: String
    active: Boolean
    allowedValues: [String]
    restricted: Boolean
  }

  type AggsState {
    timestamp: String
    state: [AggState]
  }

  type AggsStates {
    index: String
    states: [AggsState]
  }
`;
